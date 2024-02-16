import { TrainingStatus } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import { env } from '~/env/server.mjs';
import { dbWrite } from '~/server/db/client';
import { logToAxiom } from '~/server/logging/client';
import { refundTransaction } from '~/server/services/buzz.service';
import { createTrainingRequest } from '~/server/services/training.service';
import { withRetries } from '~/server/utils/errorHandling';
import { getOrchestratorCaller } from '../http/orchestrator/orchestrator.caller';
import { createJob, getJobDate } from './job';

const SUBMITTED_CHECK_INTERVAL = 10;
const PROCESSING_CHECK_INTERVAL = 20;
const REJECTED_CHECK_INTERVAL = 4 * 60;

const logJob = (data: MixedObject) => {
  logToAxiom({ name: 'handle-long-trainings', type: 'error', ...data }, 'webhooks').catch();
};

type JobStatus =
  | { status: 'Failed' }
  | {
      status: 'Succeeded' | 'Deleted' | 'Expired' | 'Processing' | 'Rejected';
      date: Date;
    };
const failedState: JobStatus = { status: 'Failed' };

async function getJobStatus(jobId: string, submittedAt: Date, log: (message: string) => void) {
  function fail(message: string) {
    log(message);
    return failedState;
  }

  const eventResp = await getOrchestratorCaller(submittedAt).getEventById({
    id: jobId,
    descending: true,
    take: 1,
  });
  if (!eventResp.ok) return fail(`Couldn't fetch events for job`);

  const eventData = eventResp.data;
  if (!eventData) return fail(`Couldn't parse JSON events for job`);
  if (!eventData.length) return fail(`No event history for job`);

  const { type: status, dateTime: date } = eventData[0];
  if (!status || !date) return fail(`Couldn't grab latest type/date for job`);

  return { status, date: new Date(date) } as JobStatus;
}

async function handleJob({
  modelFileId,
  modelVersionId,
  status,
  jobId,
  transactionId,
  submittedAt,
}: TrainingRunResult) {
  if (!jobId) {
    log(`No job ID`);
    return await requeueTraining();
  }

  const job = await getJobStatus(jobId, submittedAt, log);
  if (job.status === 'Succeeded') {
    // Ensure we have our epochs...
    const ready = await hasEpochs();
    if (ready) {
      await updateStatus('InReview');
      return true;
    }

    // If we don't have epochs, we need to fail...
    log(`No epochs`);
    (job as JobStatus).status = 'Failed';
  }

  if (job.status === 'Failed' || job.status === 'Deleted' || job.status === 'Expired') {
    await updateStatus('Failed');
    return await refund();
  }

  const jobUpdated = job.date.getTime();
  const minsDiff = (new Date().getTime() - jobUpdated) / (1000 * 60);
  // Treat rejected as processing
  if (job.status === 'Rejected') {
    if (minsDiff > REJECTED_CHECK_INTERVAL) {
      log(`Job stuck in Rejected status - resubmitting`);
      await updateStatus('Failed');
      return await refund();
      // Note: If for some reason we can't do the training run, this should be in the Failed status on the next pass.
    }
  }

  if (status === 'Submitted') {
    // - if it's not in the queue after 10 minutes, resubmit it
    if (minsDiff > SUBMITTED_CHECK_INTERVAL) {
      const queueResponse = await getOrchestratorCaller(submittedAt).getJobById({ id: jobId });
      // If we found it in the queue, we're good
      if (
        queueResponse.ok &&
        queueResponse.data?.serviceProviders &&
        !isEmpty(queueResponse.data?.serviceProviders)
      )
        return true;

      // Otherwise, resubmit it
      log(`Could not fetch position in queue.`);
      await requeueTraining();
      // Note: If for some reason we can't do the training run, this should be in the Failed status on the next pass.
    }
  }

  if (status === 'Processing') {
    // - if it hasn't gotten an update in 20 minutes, mark failed
    if (minsDiff > PROCESSING_CHECK_INTERVAL) {
      await updateStatus('Failed');
      return await refund();
    }
  }

  return true;

  //#region helper functions
  function log(message: string) {
    logJob({
      message,
      data: {
        jobId,
        modelFileId,
        important: true,
      },
    });
  }

  async function requeueTraining() {
    try {
      log(`Resubmitting training request`);
      await createTrainingRequest({ modelVersionId });
      log(`Resubmitted training request`);
      return true;
    } catch (e) {
      return log(`Error resubmitting training request`);
    }
  }

  async function refund() {
    if (!transactionId) {
      log(`No transaction ID - need to manually refund.`);
      return;
    }

    log(`Refunding transaction`);
    try {
      await withRetries(async () =>
        refundTransaction(transactionId, 'Refund due to a long-running/failed training job.')
      );
    } catch (e) {
      log(`Error refunding transaction - need to manually refund.`);
      return;
    }
    log(`Refunded transaction`);

    return true;
  }

  async function hasEpochs() {
    const [{ epochs }] = await dbWrite.$queryRaw<{ epochs: number | null }[]>`
      SELECT jsonb_array_length(metadata -> 'trainingResults' -> 'epochs') epochs
      FROM "ModelFile"
      WHERE id = ${modelFileId};
    `;
    return epochs !== null;
  }

  async function updateStatus(status: TrainingStatus) {
    await dbWrite.modelVersion.update({
      where: { id: modelVersionId },
      data: { trainingStatus: status, updatedAt: new Date() },
    });
    log(`Updated training status to ${status}`);
  }

  //#endregion
}

type TrainingRunResult = {
  modelFileId: number;
  modelVersionId: number;
  updated: string;
  status: TrainingStatus;
  jobId: string | null;
  transactionId: string | null;
  submittedAt: Date;
};

export const handleLongTrainings = createJob('handle-long-trainings', `*/10 * * * *`, async () => {
  const [lastRun, setLastRun] = await getJobDate('handle-long-trainings');
  const oldTraining = await dbWrite.$queryRaw<TrainingRunResult[]>`
    SELECT mf.id as "modelFileId",
           mv.id as "modelVersionId",
           mv."trainingStatus" as status,
           COALESCE(mf."metadata" -> 'trainingResults' ->> 'jobId',
                    mf."metadata" -> 'trainingResults' -> 'history' -> -1 ->> 'jobId') "jobId",
           mf."metadata" -> 'trainingResults' ->> 'transactionId' "transactionId",
           COALESCE(COALESCE(mf."metadata" -> 'trainingResults' ->> 'submittedAt',
		                mf."metadata" -> 'trainingResults' -> 'history' -> 0 ->> 'time')::timestamp,
		        mv."updatedAt"
	        ) "submittedAt"
    FROM "ModelVersion" mv
    JOIN "ModelFile" mf ON mv.id = mf."modelVersionId"
    JOIN "Model" m ON m.id = mv."modelId"
    WHERE mf.type = 'Training Data'
      AND m."uploadType" = 'Trained'
      AND mv."trainingStatus" in ('Processing', 'Submitted')
      -- Hasn't had a recent update
      AND mv."updatedAt" between '10/16/2023' and ${lastRun}
    --  AND ((mf.metadata -> 'trainingResults' -> 'start_time')::TEXT)::TIMESTAMP < (now() - interval '24 hours')
    ORDER BY 1 desc;
  `;

  if (oldTraining.length === 0) {
    logJob({
      type: 'info',
      message: `No long running jobs to process.`,
    });
    await setLastRun();
    return { status: 'ok' };
  }

  logJob({
    type: 'info',
    message: `Found long running jobs to process`,
    data: { count: oldTraining.length },
  });

  let successes = 0;
  for (const training of oldTraining) {
    try {
      const success = await handleJob(training);
      if (success === true) successes += 1;
    } catch (e) {
      logJob({
        message: `Error handling job`,
        data: {
          error: (e as Error)?.message,
          cause: (e as Error)?.cause,
          jobId: training.jobId,
          modelFileId: training.modelFileId,
          important: true,
        },
      });
    }
  }

  logJob({
    type: 'info',
    message: `Finished`,
    data: { successes, total: oldTraining.length },
  });

  await setLastRun();
  return { status: 'ok', successes, total: oldTraining.length };
});
