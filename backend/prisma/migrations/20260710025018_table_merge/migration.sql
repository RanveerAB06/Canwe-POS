-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "mergedToId" TEXT;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_mergedToId_fkey" FOREIGN KEY ("mergedToId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
