import type { PrismaClient } from "@prisma/client";

/**
 * 締め日ベースの期間計算ユーティリティ
 */

/**
 * 締め日から集計期間の開始日・終了日を算出
 * 例: 締め日10 → 前月11日〜当月10日
 */
export function getPeriodFromClosingDay(
  year: number,
  month: number,
  closingDay: number
): { startDate: string; endDate: string } {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(closingDay + 1).padStart(2, "0")}`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(closingDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

/**
 * 締め月ごとの対象期間を取得
 * 1. PeriodSetting に該当年月の設定があればそれを返す
 * 2. なければ CLOSING_DAY から自動計算（デフォルト10日締め）
 */
export async function getPeriodForClosingMonth(
  prisma: PrismaClient,
  year: number,
  month: number
): Promise<{ startDate: string; endDate: string }> {
  // まずは「締め月 = month」で登録された設定を優先して使用
  const custom = await prisma.periodSetting.findUnique({
    where: { year_month: { year, month } },
  });
  if (custom) {
    return { startDate: custom.startDate, endDate: custom.endDate };
  }

  // 互換対応: 以前の実装では「翌月」で登録していたため、そのデータも救済的に参照する
  const legacyMonth = month === 12 ? 1 : month + 1;
  const legacyYear = month === 12 ? year + 1 : year;
  const legacy = await prisma.periodSetting.findUnique({
    where: { year_month: { year: legacyYear, month: legacyMonth } },
  });
  if (legacy) {
    return { startDate: legacy.startDate, endDate: legacy.endDate };
  }

  const closingSetting = await prisma.setting.findUnique({
    where: { key: "CLOSING_DAY" },
  });
  const closingDay = closingSetting ? parseInt(closingSetting.value, 10) || 10 : 10;
  return getPeriodFromClosingDay(year, month, closingDay);
}

/**
 * 期間内の全営業日（日付文字列の配列）を生成
 * 日曜は休日として除外（祝日は別途 Holiday テーブルで管理）
 */
export function getDatesInPeriod(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  const current = new Date(start);
  while (current <= end) {
    dates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`
    );
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
