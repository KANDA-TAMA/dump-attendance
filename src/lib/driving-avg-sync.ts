/**
 * 運転時間の Q/R/S/T（Excel 列相当）を前後日と同期してDBに書き込む
 */
import { prisma } from "@/lib/prisma";
import {
  addCalendarDays,
  computeAvgDrivingMetrics,
} from "@/lib/attendance-utils";

function drivingOf(a: { drivingHours: number } | null | undefined): number | null {
  if (!a) return null;
  return a.drivingHours;
}

async function applyMetrics(attendanceId: string, userId: string, date: string) {
  const prevDate = addCalendarDays(date, -1);
  const nextDate = addCalendarDays(date, 1);

  const [prev, curr, next] = await Promise.all([
    prisma.attendance.findUnique({
      where: { userId_date: { userId, date: prevDate } },
      select: { drivingHours: true },
    }),
    prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
      select: { drivingHours: true },
    }),
    prisma.attendance.findUnique({
      where: { userId_date: { userId, date: nextDate } },
      select: { drivingHours: true },
    }),
  ]);

  const m = computeAvgDrivingMetrics(
    drivingOf(prev),
    drivingOf(curr),
    drivingOf(next)
  );

  try {
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        avgDrivingUpper: m.avgDrivingUpper,
        avgDrivingLower: m.avgDrivingLower,
        avgDrivingMin: m.avgDrivingMin,
        drivingJudgment: m.drivingJudgment,
      },
    });
  } catch (e) {
    console.error("applyMetrics update failed", attendanceId, e);
  }
}

/**
 * 指定ユーザーの指定日および前後日の Q/R/S/T を再計算して更新
 */
export async function syncDrivingAvgAroundDate(userId: string, date: string) {
  const prevDate = addCalendarDays(date, -1);
  const nextDate = addCalendarDays(date, 1);

  const records = await prisma.attendance.findMany({
    where: {
      userId,
      date: { in: [prevDate, date, nextDate] },
    },
    select: { id: true, date: true },
  });

  for (const r of records) {
    await applyMetrics(r.id, userId, r.date);
  }
}

/**
 * 指定ユーザーの全勤怠レコードについて Q/R/S/T を再計算（既存データの一括バックフィル用）
 */
export async function syncDrivingAvgForUser(userId: string) {
  const records = await prisma.attendance.findMany({
    where: { userId },
    select: { id: true, date: true },
    orderBy: { date: "asc" },
  });
  for (const r of records) {
    await applyMetrics(r.id, userId, r.date);
  }
  return records.length;
}

/**
 * 全ユーザーの全勤怠を再計算（管理者用・件数多いときは時間がかかる）
 */
export async function syncDrivingAvgAllUsers() {
  const records = await prisma.attendance.findMany({
    select: { id: true, userId: true, date: true },
    orderBy: [{ userId: "asc" }, { date: "asc" }],
  });
  let n = 0;
  for (const r of records) {
    await applyMetrics(r.id, r.userId, r.date);
    n++;
  }
  return n;
}
