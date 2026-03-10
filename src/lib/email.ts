import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

/**
 * メール送信
 * SMTP設定はシステム設定（Setting テーブル）から取得。未設定の場合は env をフォールバック
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const config = await getSmtpConfig();

  if (!config.host || !config.user || !config.pass) {
    console.warn("[Email] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in システム設定.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: `"勤怠システム" <${config.user}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("[Email] Send failed:", error);
    return false;
  }
}

/**
 * SMTP設定を取得（DB優先、なければ env）
 */
async function getSmtpConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  pass: string;
}> {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return {
    host: map.SMTP_HOST || process.env.SMTP_HOST || "",
    port: map.SMTP_PORT
      ? parseInt(map.SMTP_PORT, 10)
      : process.env.SMTP_PORT
        ? parseInt(process.env.SMTP_PORT, 10)
        : 587,
    user: map.SMTP_USER || process.env.SMTP_USER || "",
    pass: map.SMTP_PASS || process.env.SMTP_PASS || "",
  };
}
