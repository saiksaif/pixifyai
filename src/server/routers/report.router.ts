import {
  bulkUpdateReportStatusHandler,
  createReportHandler,
  getReportsHandler,
  setReportStatusHandler,
  updateReportHandler,
} from '~/server/controllers/report.controller';
import { isModerator } from '~/server/routers/base.router';
import {
  bulkUpdateReportStatusSchema,
  createReportInputSchema,
  getReportsSchema,
  setReportStatusSchema,
  updateReportSchema,
} from '~/server/schema/report.schema';
import { guardedProcedure, protectedProcedure, router } from '~/server/trpc';

export const reportRouter = router({
  create: guardedProcedure.input(createReportInputSchema).mutation(createReportHandler),
  getAll: protectedProcedure.input(getReportsSchema).use(isModerator).query(getReportsHandler),
  update: protectedProcedure
    .input(updateReportSchema)
    .use(isModerator)
    .mutation(updateReportHandler),
  setStatus: protectedProcedure
    .input(setReportStatusSchema)
    .use(isModerator)
    .mutation(setReportStatusHandler),
  bulkUpdateStatus: protectedProcedure
    .input(bulkUpdateReportStatusSchema)
    .use(isModerator)
    .mutation(bulkUpdateReportStatusHandler),
});
