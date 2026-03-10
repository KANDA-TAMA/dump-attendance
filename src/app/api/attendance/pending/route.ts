import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;
  const status = searchParams.get("status") || "PENDING";
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const where: Record<string, unknown> = {};

  if (userId) {
    where.userId = userId;
  } else {
    // 社員未指定時は運転手のみ（管理者・運行管理者は承認対象外）
    where.user = { role: "DRIVER" };
  }

  if (status !== "ALL") {
    where.approvalStatus = status;
  }

  if (year && month) {
    const y = parseInt(year);
    const m = parseInt(month);
    const startDate = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-11`;
    const endDate = `${y}-${String(m).padStart(2, "0")}-10`;
    where.date = { gte: startDate, lte: endDate };
  }

  const attendances = await prisma.attendance.findMany({
    where,
    orderBy: [{ date: "asc" }, { userId: "asc" }],
    include: {
      user: { select: { name: true, employeeId: true } },
      approver: { select: { name: true } },
    },
  });

  return NextResponse.json(attendances);
}
