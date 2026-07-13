-- RefiningBatch is unused: no API route, service, or UI references it
-- (only src/services/batch-number.service.ts, which is itself never imported
-- outside its own test file). Dropping the dead table and its enums.

-- DropTable
DROP TABLE "RefiningBatch";

-- DropEnum
DROP TYPE "RefiningMethod";

-- DropEnum
DROP TYPE "RefiningBatchStatus";
