import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodForClosingMonth } from "@/lib/period-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

  const isAll = userIdParam === "ALL";
  const userId = isAll ? undefined : (userIdParam || session.user.id);

  // 管理者・運行管理者以外は自分のデータのみ
  if (!isAll && userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  // 全員一覧は管理者・運行管理者のみ
  if (isAll && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let startDate: string;
  let endDate: string;
  try {
    const period = await getPeriodForClosingMonth(prisma, year, month);
    startDate = period.startDate;
    endDate = period.endDate;
  } catch (e) {
    console.error("Period resolution error:", e);
    return NextResponse.json({ error: "期間の取得に失敗しました" }, { status: 500 });
  }

  try {
    const where: Record<string, unknown> = {
      date: { gte: startDate, lte: endDate },
    };
    if (userId) {
      where.userId = userId;
    } else if (isAll) {
      // 全員一括は運転手のみ対象（管理者・運行管理者は管理対象外）
      where.user = { role: "DRIVER" };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: [{ userId: "asc" }, { date: "asc" }],
      include: {
        user: { select: { name: true, employeeId: true } },
        approver: { select: { name: true } },
      },
    });

    return NextResponse.json({
      period: { startDate, endDate, year, month },
      attendances,
    });
  } catch (error) {
    console.error("Monthly data error:", error);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
