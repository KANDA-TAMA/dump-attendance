-- CreateTable
CREATE TABLE "DriverPeriodCompletionNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverPeriodCompletionNotification_userId_periodStart_periodEnd_key" ON "DriverPeriodCompletionNotification"("userId", "periodStart", "periodEnd");
