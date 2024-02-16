import { TrainingStatus } from '@prisma/client';
import { trainingSettings } from '~/components/Resource/Forms/Training/TrainingSubmit';
import { env } from '~/env/server.mjs';
import { constants } from '~/server/common/constants';
import { dbWrite } from '~/server/db/client';
import { TransactionType } from '~/server/schema/buzz.schema';
import { TrainingDetailsBaseModel, TrainingDetailsObj } from '~/server/schema/model-version.schema';
import { CreateTrainingRequestInput, MoveAssetInput } from '~/server/schema/training.schema';
import {
  createBuzzTransaction,
  getUserBuzzAccount,
  refundTransaction,
} from '~/server/services/buzz.service';
import {
  throwBadRequestError,
  throwInsufficientFundsError,
  throwRateLimitError,
  withRetries,
} from '~/server/utils/errorHandling';
import { getGetUrl, getPutUrl } from '~/utils/s3-utils';
import { calcBuzzFromEta, calcEta } from '~/utils/training';
import { getOrchestratorCaller } from '../http/orchestrator/orchestrator.caller';
import { Orchestrator } from '../http/orchestrator/orchestrator.types';

const modelMap: { [key in TrainingDetailsBaseModel]: string } = {
  sdxl: 'civitai:101055@128078',
  sd_1_5: 'SD_1_5',
  // anime: 'civitai:9409@33672', // TODO [bw] adjust this with rick
  anime: 'anime',
  realistic: 'civitai:81458@132760',
  semi: 'civitai:4384@128713',
};

type TrainingRequest = {
  trainingDetails: TrainingDetailsObj;
  modelName: string;
  trainingUrl: string;
  fileId: number;
  userId: number;
  fileMetadata: FileMetadata | null;
};

async function getSubmittedAt(modelVersionId: number, userId: number) {
  const [modelFile] = await dbWrite.$queryRaw<MoveAssetRow[]>`
    SELECT mf.metadata, mv."updatedAt"
    FROM "ModelVersion" mv
    JOIN "ModelFile" mf ON mf."modelVersionId" = mv.id AND mf.type = 'Training Data'
    JOIN "Model" m ON m.id = mv."modelId"
    WHERE mv.id = ${modelVersionId} AND m."userId" = ${userId}
  `;

  if (!modelFile) throw throwBadRequestError('Invalid model version');
  if (modelFile.metadata?.trainingResults?.submittedAt) {
    return new Date(modelFile.metadata.trainingResults.submittedAt);
  } else if (modelFile.metadata?.trainingResults?.history) {
    for (const { status, time } of modelFile.metadata.trainingResults.history) {
      if (status === TrainingStatus.Submitted) {
        return new Date(time);
        break;
      }
    }
  }

  return modelFile.updatedAt;
}

const assetUrlRegex =
  /\/v\d\/consumer\/jobs\/(?<jobId>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/assets\/(?<assetName>\S+)$/i;

type MoveAssetRow = {
  metadata: FileMetadata | null;
  updatedAt: Date;
};
export const moveAsset = async ({
  url,
  modelVersionId,
  modelId,
  userId,
}: MoveAssetInput & { userId: number }) => {
  const urlMatch = url.match(assetUrlRegex);
  if (!urlMatch || !urlMatch.groups) throw throwBadRequestError('Invalid URL');
  const { jobId, assetName } = urlMatch.groups;

  const { url: destinationUri } = await getPutUrl(`model/${modelId}/${assetName}`);

  const reqBody: Orchestrator.Training.CopyAssetJobPayload = {
    jobId,
    assetName,
    destinationUri,
  };

  const submittedAt = await getSubmittedAt(modelVersionId, userId);
  const response = await getOrchestratorCaller(submittedAt).copyAsset({
    payload: reqBody,
    queryParams: { wait: true },
  });
  if (response.status === 429) {
    throw throwRateLimitError();
  }

  if (!response.ok) {
    throw throwBadRequestError('Failed to move asset. Please try selecting the file again.');
  }

  const result = response.data?.jobs?.[0]?.result;
  if (!result || !result.found) {
    throw throwBadRequestError('Failed to move asset. Please try selecting the file again.');
  }

  const newUrl = destinationUri.split('?')[0];

  return {
    newUrl,
    fileSize: result.fileSize,
  };
};

export const deleteAssets = async (jobId: string, submittedAt?: Date) => {
  const response = await getOrchestratorCaller(submittedAt).clearAssets({
    payload: { jobId },
    queryParams: { wait: true },
  });

  if (response.status === 429) {
    throw throwRateLimitError();
  }

  if (!response.ok) {
    throw throwBadRequestError('Failed to delete assets');
  }

  return response.data?.jobs?.[0]?.result;
};

export const createTrainingRequest = async ({
  userId,
  modelVersionId,
}: CreateTrainingRequestInput & { userId?: number }) => {
  const modelVersions = await dbWrite.$queryRaw<TrainingRequest[]>`
    SELECT mv."trainingDetails",
           m.name      "modelName",
           m."userId",
           mf.url      "trainingUrl",
           mf.id       "fileId",
           mf.metadata "fileMetadata"
    FROM "ModelVersion" mv
           JOIN "Model" m ON m.id = mv."modelId"
           JOIN "ModelFile" mf ON mf."modelVersionId" = mv.id AND mf.type = 'Training Data'
    WHERE mv.id = ${modelVersionId}
  `;

  if (modelVersions.length === 0) throw throwBadRequestError('Invalid model version');
  const modelVersion = modelVersions[0];

  // Don't allow a user to queue anything but their own training
  if (userId && userId != modelVersion.userId) throw throwBadRequestError('Invalid user');

  const trainingParams = modelVersion.trainingDetails.params;
  const baseModel = modelVersion.trainingDetails.baseModel;
  if (!trainingParams) throw throwBadRequestError('Missing training params');
  for (const [key, value] of Object.entries(trainingParams)) {
    const setting = trainingSettings.find((ts) => ts.name === key);
    if (!setting) continue;
    // TODO [bw] we should be doing more checking here (like validating this through zod), but this will handle the bad cases for now
    if (typeof value === 'number') {
      const override = baseModel ? setting.overrides?.[baseModel] : undefined;
      const overrideSetting = override ?? setting;
      if (
        (overrideSetting.min && value < overrideSetting.min) ||
        (overrideSetting.max && value > overrideSetting.max)
      ) {
        throw throwBadRequestError(
          `Invalid settings for training: "${key}" is outside allowed min/max.`
        );
      }
    }
  }

  // Determine if we still need to charge them for this training
  let transactionId = modelVersion.fileMetadata?.trainingResults?.transactionId;
  if (!transactionId) {
    // And if so, charge them
    const eta = calcEta(
      trainingParams.networkDim,
      trainingParams.networkAlpha,
      trainingParams.targetSteps,
      baseModel
    );
    const price = eta !== undefined ? calcBuzzFromEta(eta) : eta;
    if (price === undefined) {
      throw throwBadRequestError(
        'Could not compute Buzz price for training - please check your parameters.'
      );
    }
    const account = await getUserBuzzAccount({ accountId: modelVersion.userId });
    if ((account.balance ?? 0) < price) {
      throw throwInsufficientFundsError(
        `You don't have enough Buzz to perform this action (required: ${price})`
      );
    }

    // nb: going to hold off on externalTransactionId for now
    //     if we fail it, they'll never be able to proceed
    //     if we catch it, we have to match on a very changeable error message rather than code
    //        also, we will not have a transactionId, which means we can't refund them later in the process
    const { transactionId: newTransactionId } = await createBuzzTransaction({
      fromAccountId: modelVersion.userId,
      toAccountId: 0,
      amount: price,
      type: TransactionType.Training,
      // externalTransactionId: `training|mvId:${modelVersionId}`,
    });
    transactionId = newTransactionId;
  }

  const { url: trainingUrl } = await getGetUrl(modelVersion.trainingUrl);
  const generationRequest: Orchestrator.Training.ImageResourceTrainingJobPayload = {
    // priority: 10,
    callbackUrl: `${env.GENERATION_CALLBACK_HOST}/api/webhooks/resource-training?token=${env.WEBHOOK_TOKEN}`,
    properties: { userId, transactionId, modelFileId: modelVersion.fileId },
    model: modelMap[baseModel!],
    trainingData: trainingUrl,
    maxRetryAttempt: constants.maxTrainingRetries,
    params: {
      ...trainingParams,
      modelFileId: modelVersion.fileId,
      loraName: modelVersion.modelName,
    },
  };

  const response = await getOrchestratorCaller(new Date()).imageResourceTraining({
    payload: generationRequest,
  });
  if (!response.ok && transactionId) {
    await withRetries(async () =>
      refundTransaction(
        transactionId as string,
        'Refund due to an error submitting the training job.'
      )
    );
  }

  if (response.status === 429) {
    throw throwRateLimitError();
  }

  if (!response.ok) {
    throw throwBadRequestError(
      'We are not able to process your request at this time. Please try again later'
    );
  }

  const data = response.data;
  const fileMetadata = modelVersion.fileMetadata || {};

  await dbWrite.modelFile.update({
    where: { id: modelVersion.fileId },
    data: {
      metadata: {
        ...fileMetadata,
        trainingResults: {
          ...(fileMetadata.trainingResults || {}),
          submittedAt: new Date().toISOString(),
          jobId: data?.jobs?.[0]?.jobId,
          transactionId,
          history: (fileMetadata.trainingResults?.history || []).concat([
            {
              time: new Date().toISOString(),
              status: TrainingStatus.Submitted,
            },
          ]),
        },
      },
    },
  });

  // const [formatted] = await formatGenerationRequests([data]);
  return data;
};
