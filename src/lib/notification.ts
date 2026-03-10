import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getPeriodForClosingMonth } from "@/lib/period-utils";

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * 日次：運転手の勤怠保存時に、その日の全運転手の保存が完了したタイミングで
 * 優先順位で指定された運行管理者にメールを送信
 */
export async function checkAndNotifyDailyDriverSaveCompletion(date: string): Promise<void> {
  const existing = await prisma.dayDriverSaveCompletionNotification.findUnique({
    where: { date },
  });
  if (existing) return;

  const activeDriverCount = await prisma.user.count({
    where: { role: "DRIVER", isActive: true },
  });
  if (activeDriverCount === 0) return;

  const driversWithAttendance = await prisma.attendance.groupBy({
    by: ["userId"],
    where: { date, user: { role: "DRIVER" } },
  });

  if (driversWithAttendance.length < activeDriverCount) return;

  const settings = await prisma.managerNotificationSetting.findMany({
    where: { user: { role: "MANAGER", isActive: true } },
    include: { user: true },
    orderBy: { priority: "asc" },
  });

  if (settings.length === 0) return;

  const target = settings[0];
  if (!target.email?.trim()) return;

  const subject = `【勤怠システム】${date} の運転手勤怠入力が完了しました`;
  const html = `
    <p>${date} の全運転手の勤怠保存が完了しました。</p>
    <p>承認処理をお願いします。</p>
    <p><a href="${BASE_URL}/dashboard/admin/approval">勤怠承認画面へ</a></p>
  `;

  const sent = await sendEmail(target.email, subject, html);
  if (sent) {
    await prisma.dayDriverSaveCompletionNotification.create({
      data: { date },
    });
  }
}

/**
 * 対象期間の勤怠がすべて承認済みかチェックし、完了していれば通知を送信
 * 送信先：優先順位で指定された運行管理者 + 管理者全員
 */
export async function checkAndNotifyPeriodApprovalCompletion(): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { startDate, endDate } = await getPeriodForClosingMonth(prisma, year, month);

  const pendingCount = await prisma.attendance.count({
    where: {
      date: { gte: startDate, lte: endDate },
      user: { role: "DRIVER" },
      approvalStatus: { not: "APPROVED" },
    },
  });

  if (pendingCount === 0) {
    sendPeriodApprovalCompletionNotification(startDate, endDate).catch((e) =>
      console.error("[Notification] Period completion:", e)
    );
  }
}

/**
 * 対象期間の勤怠をすべて承認したタイミングで、運行管理者にメール通知
 * 送信先：優先順位で指定された運行管理者 + 管理者全員
 */
export async function sendPeriodApprovalCompletionNotification(
  periodStartDate: string,
  periodEndDate: string
): Promise<void> {
  const existing = await prisma.periodApprovalCompletionNotification.findUnique({
    where: {
      periodStart_periodEnd: { periodStart: periodStartDate, periodEnd: periodEndDate },
    },
  });
  if (existing) return;

  const subject = `【勤怠システム】${periodStartDate} 〜 ${periodEndDate} の期間承認が完了しました`;
  const html = `
    <p>対象期間の勤怠承認がすべて完了しました。</p>
    <p>期間: ${periodStartDate} 〜 ${periodEndDate}</p>
    <p><a href="${BASE_URL}/dashboard/admin/approval">勤怠承認画面へ</a></p>
  `;

  const recipients: string[] = [];

  // 優先順位で指定された運行管理者（ManagerNotificationSetting に登録されている全員）
  const managerSettings = await prisma.managerNotificationSetting.findMany({
    where: { user: { role: "MANAGER", isActive: true } },
    orderBy: { priority: "asc" },
  });
  for (const s of managerSettings) {
    if (s.email?.trim()) recipients.push(s.email);
  }

  // 管理者全員（User の email）
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { email: true },
  });
  for (const a of admins) {
    if (a.email?.trim() && !recipients.includes(a.email)) {
      recipients.push(a.email);
    }
  }

  for (const email of recipients) {
    await sendEmail(email, subject, html);
  }

  await prisma.periodApprovalCompletionNotification.create({
    data: { periodStart: periodStartDate, periodEnd: periodEndDate },
  });
}
