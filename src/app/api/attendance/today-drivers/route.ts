import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

/**
 * 当日分の運転手別勤怠一覧（管理者・運行管理者のみ）
 * 運転手は未入力でも1行として返す
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const today = format(new Date(), "yyyy-MM-dd");

  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER", isActive: true },
    select: { id: true, name: true, employeeId: true },
    orderBy: { employeeId: "asc" },
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      date: today,
      userId: { in: drivers.map((d) => d.id) },
    },
  });

  const byUserId = new Map(attendances.map((a) => [a.userId, a]));

  const rows = drivers.map((d) => {
    const a = byUserId.get(d.id);
    return {
      userId: d.id,
      name: d.name,
      employeeId: d.employeeId,
      attendance: a
        ? {
            id: a.id,
            clockInRaw: a.clockInRaw,
            clockOutRaw: a.clockOutRaw,
            clockInRounded: a.clockInRounded,
            clockOutRounded: a.clockOutRounded,
            actualHours: a.actualHours,
            drivingHours: a.drivingHours,
            loadingHours: a.loadingHours,
            breakHours: a.breakHours,
            overtimeHours: a.overtimeHours,
            earlyOvertimeHours: a.earlyOvertimeHours,
            lateMinutes: a.lateMinutes,
            earlyLeaveMinutes: a.earlyLeaveMinutes,
            approvalStatus: a.approvalStatus,
            category: a.category,
          }
        : null,
    };
  });

  return NextResponse.json({ date: today, rows });
}
