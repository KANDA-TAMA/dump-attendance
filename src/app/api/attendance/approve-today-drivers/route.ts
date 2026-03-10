import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndNotifyPeriodApprovalCompletion } from "@/lib/notification";
import { format } from "date-fns";

/**
 * 運転手全員の「当日分」未承認勤怠を一括承認（管理者・運行管理者のみ）
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const today = format(new Date(), "yyyy-MM-dd");

  try {
    const targets = await prisma.attendance.findMany({
      where: {
        date: today,
        approvalStatus: "PENDING",
        user: { role: "DRIVER" },
      },
      select: { id: true },
    });

    if (targets.length === 0) {
      return NextResponse.json({
        approvedCount: 0,
        date: today,
        message: "当日分の未承認勤怠はありません",
      });
    }

    const now = new Date();
    await prisma.$transaction(
      targets.map((t) =>
        prisma.attendance.update({
          where: { id: t.id },
          data: {
            approvalStatus: "APPROVED",
            approvedBy: session.user.id,
            approvedAt: now,
            approvalNote: null,
          },
        })
      )
    );

    // 対象期間の勤怠がすべて承認済みかチェック
    checkAndNotifyPeriodApprovalCompletion().catch((e) =>
      console.error("[Notification]", e)
    );

    return NextResponse.json({
      approvedCount: targets.length,
      date: today,
      message: `${targets.length}件を承認しました`,
    });
  } catch (error) {
    console.error("Approve today drivers error:", error);
    return NextResponse.json({ error: "一括承認に失敗しました" }, { status: 500 });
  }
}
