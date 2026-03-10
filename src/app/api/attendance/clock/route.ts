import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import {
  roundTimeForPayroll,
  calcActualHours,
  calcLoadingHours,
  calcOvertimeHours,
  calcEarlyOvertimeHours,
  calcLateMinutes,
  calcEarlyLeaveMinutes,
  getDayOfWeek,
  getDefaultCategory,
  type CategoryKey,
} from "@/lib/attendance-utils";
import { syncDrivingAvgAroundDate } from "@/lib/driving-avg-sync";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;
  const today = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");

  try {
    if (action === "clock-in") {
      const rounded = roundTimeForPayroll(nowTime);
      const defaultCat = getDefaultCategory(today);
      const earlyOvertimeHours = calcEarlyOvertimeHours(rounded, defaultCat);
      const lateMinutes = calcLateMinutes(rounded, defaultCat);

      const attendance = await prisma.attendance.upsert({
        where: {
          userId_date: { userId: session.user.id, date: today },
        },
        update: {
          clockInRaw: nowTime,
          clockInRounded: rounded,
          earlyOvertimeHours,
          lateMinutes,
        },
        create: {
          userId: session.user.id,
          date: today,
          dayOfWeek: getDayOfWeek(today),
          clockInRaw: nowTime,
          clockInRounded: rounded,
          category: defaultCat,
          earlyOvertimeHours,
          lateMinutes,
        },
      });
      await syncDrivingAvgAroundDate(session.user.id, today);
      const refreshed = await prisma.attendance.findUnique({
        where: { id: attendance.id },
      });
      return NextResponse.json(refreshed ?? attendance);
    }

    if (action === "clock-out") {
      const existing = await prisma.attendance.findUnique({
        where: { userId_date: { userId: session.user.id, date: today } },
      });
      if (!existing) {
        return NextResponse.json({ error: "出勤記録がありません" }, { status: 400 });
      }

      const rounded = roundTimeForPayroll(nowTime);
      const cat = existing.category as CategoryKey;
      const actualHours = calcActualHours(
        existing.clockInRounded,
        rounded,
        existing.breakHours
      );
      const loadingHours = calcLoadingHours(actualHours, existing.drivingHours);
      const overtimeHours = calcOvertimeHours(actualHours, cat);
      const earlyOvertimeHours = calcEarlyOvertimeHours(existing.clockInRounded, cat);
      const lateMinutes = calcLateMinutes(existing.clockInRounded, cat);
      const earlyLeaveMinutes = calcEarlyLeaveMinutes(rounded, cat);

      const attendance = await prisma.attendance.update({
        where: { userId_date: { userId: session.user.id, date: today } },
        data: {
          clockOutRaw: nowTime,
          clockOutRounded: rounded,
          actualHours,
          loadingHours,
          overtimeHours,
          earlyOvertimeHours,
          lateMinutes,
          earlyLeaveMinutes,
        },
      });
      await syncDrivingAvgAroundDate(session.user.id, today);
      const refreshed = await prisma.attendance.findUnique({
        where: { id: attendance.id },
      });
      return NextResponse.json(refreshed ?? attendance);
    }

    return NextResponse.json({ error: "不正なアクション" }, { status: 400 });
  } catch (error) {
    console.error("Attendance error:", error);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
