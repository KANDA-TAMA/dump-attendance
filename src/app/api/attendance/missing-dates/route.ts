import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodForClosingMonth, getDatesInPeriod } from "@/lib/period-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 主に運転手向けだが、管理者・運行管理者も自分の勤怠未入力日を確認可能

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

  try {
    const { startDate, endDate } = await getPeriodForClosingMonth(prisma, year, month);
    const allDates = getDatesInPeriod(startDate, endDate);

    const existing = await prisma.attendance.findMany({
      where: {
        userId: session.user.id,
        date: { in: allDates },
      },
      select: { date: true },
    });
    const existingSet = new Set(existing.map((a) => a.date));
    const missingDates = allDates.filter((d) => !existingSet.has(d));

    return NextResponse.json({
      period: { startDate, endDate, year, month },
      missingDates,
    });
  } catch (error) {
    console.error("Missing dates error:", error);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
