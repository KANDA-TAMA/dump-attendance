-- CreateTable
CREATE TABLE "DayDriverSaveCompletionNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DayDriverSaveCompletionNotification_date_key" ON "DayDriverSaveCompletionNotification"("date");
