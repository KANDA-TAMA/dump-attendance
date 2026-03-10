import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndNotifyPeriodApprovalCompletion } from "@/lib/notification";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { attendanceId, action, note } = await req.json();

  if (!attendanceId || !action) {
    return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
  }

  try {
    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        approvalStatus: action === "approve" ? "APPROVED" : "REJECTED",
        approvedBy: session.user.id,
        approvedAt: new Date(),
        approvalNote: note || null,
      },
    });

    // 対象期間の勤怠がすべて承認済みかチェックし、完了していれば期間完了メールを送信
    checkAndNotifyPeriodApprovalCompletion().catch((e) =>
      console.error("[Notification]", e)
    );

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "承認処理に失敗しました" }, { status: 500 });
  }
}
