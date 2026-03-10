import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncDrivingAvgAroundDate } from "@/lib/driving-avg-sync";
import { checkAndNotifyDailyDriverSaveCompletion } from "@/lib/notification";
import {
  roundTimeForPayroll,
  calcActualHours,
  calcLoadingHours,
  calcOvertimeHours,
  calcEarlyOvertimeHours,
  calcLateMinutes,
  calcEarlyLeaveMinutes,
  getDayOfWeek,
  type CategoryKey,
} from "@/lib/attendance-utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await req.json();
  const {
    date,
    category,
    clockInRaw,
    clockOutRaw,
    drivingHours,
    breakHours,
    note,
  } = body;

  if (!date) {
    return NextResponse.json({ error: "日付は必須です" }, { status: 400 });
  }

  try {
    const clockInRounded = clockInRaw ? roundTimeForPayroll(clockInRaw) : null;
    const clockOutRounded = clockOutRaw ? roundTimeForPayroll(clockOutRaw) : null;
    const bh = breakHours ?? 1.0;
    const dh = drivingHours ?? 0;

    const cat = (category || "WORK1") as CategoryKey;
    const actualHours = calcActualHours(clockInRounded, clockOutRounded, bh);
    const loadingHours = calcLoadingHours(actualHours, dh);
    const overtimeHours = calcOvertimeHours(actualHours, cat);
    const earlyOvertimeHours = calcEarlyOvertimeHours(clockInRounded, cat);
    const lateMinutes = calcLateMinutes(clockInRounded, cat);
    const earlyLeaveMinutes = calcEarlyLeaveMinutes(clockOutRounded, cat);

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: { userId: session.user.id, date },
      },
      update: {
        category: cat,
        clockInRaw: clockInRaw || null,
        clockOutRaw: clockOutRaw || null,
        clockInRounded,
        clockOutRounded,
        drivingHours: dh,
        breakHours: bh,
        actualHours,
        loadingHours,
        overtimeHours,
        earlyOvertimeHours,
        lateMinutes,
        earlyLeaveMinutes,
        note: note || null,
        approvalStatus: "PENDING",
      },
      create: {
        userId: session.user.id,
        date,
        dayOfWeek: getDayOfWeek(date),
        category: cat,
        clockInRaw: clockInRaw || null,
        clockOutRaw: clockOutRaw || null,
        clockInRounded,
        clockOutRounded,
        drivingHours: dh,
        breakHours: bh,
        actualHours,
        loadingHours,
        overtimeHours,
        earlyOvertimeHours,
        lateMinutes,
        earlyLeaveMinutes,
        note: note || null,
      },
    });

    await syncDrivingAvgAroundDate(session.user.id, date);

    // 運転手の保存時：その日の全運転手の保存が完了したら優先順位の運行管理者にメール通知
    if (session.user.role === "DRIVER") {
      checkAndNotifyDailyDriverSaveCompletion(date).catch((e) =>
        console.error("[Notification]", e)
      );
    }

    const updated = await prisma.attendance.findUnique({
      where: { id: attendance.id },
    });
    return NextResponse.json(updated ?? attendance);
  } catch (error) {
    console.error("Attendance save error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
