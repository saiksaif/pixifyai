import { z } from 'zod';
import { ModEndpoint } from '~/server/utils/endpoint-helpers';
import { SearchIndexUpdateQueueAction } from '@prisma/client';
import { MODELS_SEARCH_INDEX, USERS_SEARCH_INDEX } from '~/server/common/constants';
import { modelsSearchIndex, usersSearchIndex } from '~/server/search-index';
import { NextApiRequest, NextApiResponse } from 'next';
import { commaDelimitedNumberArray } from '~/utils/zod-helpers';

export const schema = z.object({
  updateIds: commaDelimitedNumberArray().optional(),
  deleteIds: commaDelimitedNumberArray().optional(),
  index: z.enum([MODELS_SEARCH_INDEX, USERS_SEARCH_INDEX]),
});
export default ModEndpoint(async function updateIndexSync(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const input = schema.parse(req.query);

    const data = [
      ...(input.updateIds ?? []).map((id) => ({ id, action: SearchIndexUpdateQueueAction.Update })),
      ...(input.deleteIds ?? []).map((id) => ({ id, action: SearchIndexUpdateQueueAction.Delete })),
    ];

    if (!data.length) {
      throw new Error('No ids provided');
    }

    switch (input.index) {
      case USERS_SEARCH_INDEX:
        await usersSearchIndex.updateSync(data);
        break;
      case MODELS_SEARCH_INDEX:
        await modelsSearchIndex.updateSync(data);
        break;
      default:
        break;
    }

    res.status(200).send({ status: 'ok' });
  } catch (error: unknown) {
    res.status(500).send(error);
  }
});
