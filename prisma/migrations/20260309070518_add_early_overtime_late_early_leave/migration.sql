-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dayOfWeek" TEXT,
    "clockInRaw" TEXT,
    "clockOutRaw" TEXT,
    "category" TEXT NOT NULL DEFAULT 'WORK1',
    "clockInRounded" TEXT,
    "clockOutRounded" TEXT,
    "drivingHours" REAL NOT NULL DEFAULT 0,
    "loadingHours" REAL NOT NULL DEFAULT 0,
    "breakHours" REAL NOT NULL DEFAULT 1.0,
    "actualHours" REAL NOT NULL DEFAULT 0,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "earlyOvertimeHours" REAL NOT NULL DEFAULT 0,
    "lateMinutes" REAL NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" REAL NOT NULL DEFAULT 0,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "approvalNote" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("actualHours", "approvalNote", "approvalStatus", "approvedAt", "approvedBy", "breakHours", "category", "clockInRaw", "clockInRounded", "clockOutRaw", "clockOutRounded", "createdAt", "date", "dayOfWeek", "drivingHours", "id", "loadingHours", "note", "overtimeHours", "updatedAt", "userId") SELECT "actualHours", "approvalNote", "approvalStatus", "approvedAt", "approvedBy", "breakHours", "category", "clockInRaw", "clockInRounded", "clockOutRaw", "clockOutRounded", "createdAt", "date", "dayOfWeek", "drivingHours", "id", "loadingHours", "note", "overtimeHours", "updatedAt", "userId" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
