/*
  Warnings:

  - You are about to drop the `DriverPeriodCompletionNotification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DriverPeriodCompletionNotification";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PeriodApprovalCompletionNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodApprovalCompletionNotification_periodStart_periodEnd_key" ON "PeriodApprovalCompletionNotification"("periodStart", "periodEnd");
