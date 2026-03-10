/**
 * 勤怠計算ユーティリティ
 * 設計書の仕様に基づく時刻丸め・時間計算ロジック
 */

// 区分の定義
export const CATEGORIES = {
  WORK1: { label: "出勤①", startTime: "06:30", endTime: "15:30", isWork: true },
  WORK2: { label: "出勤②", startTime: "08:00", endTime: "17:00", isWork: true },
  LEGAL_HOLIDAY: { label: "法定休日出勤", startTime: null, endTime: null, isWork: true },
  PRESCRIBED_HOLIDAY: { label: "所定休日出勤", startTime: null, endTime: null, isWork: true },
  PAID_LEAVE: { label: "有給", startTime: null, endTime: null, isWork: false },
  AM_LEAVE: { label: "午前有給", startTime: null, endTime: null, isWork: false },
  PM_LEAVE: { label: "午後有給", startTime: null, endTime: null, isWork: false },
  ABSENT: { label: "欠勤", startTime: null, endTime: null, isWork: false },
  HOLIDAY: { label: "休日", startTime: null, endTime: null, isWork: false },
  SPECIAL_LEAVE: { label: "特休", startTime: null, endTime: null, isWork: false },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const CATEGORY_OPTIONS: { value: CategoryKey; label: string }[] = Object.entries(
  CATEGORIES
).map(([value, def]) => ({
  value: value as CategoryKey,
  label: def.label,
}));

/**
 * 給与計算用の時刻丸め（30分単位）
 *
 * 設計書ルール:
 *  - 1〜15分  → 00分（切り捨て）
 *  - 16〜45分 → 30分
 *  - 46〜59分 → 打刻時間+1時間 00分
 *
 * @param timeStr "HH:mm" 形式
 * @returns 丸め後の "HH:mm" 形式
 */
export function roundTimeForPayroll(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  let hour = h;
  let minute: number;

  if (m >= 1 && m <= 15) {
    minute = 0;
  } else if (m >= 16 && m <= 45) {
    minute = 30;
  } else if (m >= 46) {
    hour = h + 1;
    minute = 0;
  } else {
    minute = 0;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * HH:mm 形式の時刻を分に変換
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * 分を時間(小数)に変換
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * 実働時間を計算
 * 実働時間 = 退勤時刻 - 出勤時刻 - 休憩時間
 * 出勤時刻または退勤時刻が空の場合は0
 */
export function calcActualHours(
  clockInRounded: string | null,
  clockOutRounded: string | null,
  breakHours: number
): number {
  if (!clockInRounded || !clockOutRounded) return 0;
  const inMin = timeToMinutes(clockInRounded);
  const outMin = timeToMinutes(clockOutRounded);
  const workMin = outMin - inMin - breakHours * 60;
  return workMin > 0 ? minutesToHours(workMin) : 0;
}

/**
 * 荷役時間を計算
 * 荷役時間 = 実働時間 - 運転時間
 */
export function calcLoadingHours(
  actualHours: number,
  drivingHours: number
): number {
  const result = actualHours - drivingHours;
  return result > 0 ? Math.round(result * 10) / 10 : 0;
}

/**
 * 残業時間を計算
 * 区分の所定労働時間を超えた分
 */
export function calcOvertimeHours(
  actualHours: number,
  category: CategoryKey
): number {
  const catDef = CATEGORIES[category];
  if (!catDef.startTime || !catDef.endTime) return 0;

  const startMin = timeToMinutes(catDef.startTime);
  const endMin = timeToMinutes(catDef.endTime);
  const standardHours = (endMin - startMin - 60) / 60; // 休憩1時間引く

  const overtime = actualHours - standardHours;
  return overtime > 0 ? Math.round(overtime * 10) / 10 : 0;
}

/**
 * 早朝残業時間を計算
 * 所定開始時刻より前に出勤した場合の勤務時間（時間単位）
 * 丸め後の出勤時刻が所定開始時刻より前の場合に発生
 */
export function calcEarlyOvertimeHours(
  clockInRounded: string | null,
  category: CategoryKey
): number {
  if (!clockInRounded) return 0;
  const catDef = CATEGORIES[category];
  if (!catDef.startTime) return 0;

  const inMin = timeToMinutes(clockInRounded);
  const startMin = timeToMinutes(catDef.startTime);

  if (inMin < startMin) {
    return minutesToHours(startMin - inMin);
  }
  return 0;
}

/**
 * 遅刻時間を計算（分単位）
 * 丸め後の出勤時刻が所定開始時刻より後の場合に発生
 */
export function calcLateMinutes(
  clockInRounded: string | null,
  category: CategoryKey
): number {
  if (!clockInRounded) return 0;
  const catDef = CATEGORIES[category];
  if (!catDef.startTime) return 0;

  const inMin = timeToMinutes(clockInRounded);
  const startMin = timeToMinutes(catDef.startTime);

  if (inMin > startMin) {
    return inMin - startMin;
  }
  return 0;
}

/**
 * 早退時間を計算（分単位）
 * 丸め後の退勤時刻が所定終了時刻より前の場合に発生
 */
export function calcEarlyLeaveMinutes(
  clockOutRounded: string | null,
  category: CategoryKey
): number {
  if (!clockOutRounded) return 0;
  const catDef = CATEGORIES[category];
  if (!catDef.endTime) return 0;

  const outMin = timeToMinutes(clockOutRounded);
  const endMin = timeToMinutes(catDef.endTime);

  if (outMin < endMin) {
    return endMin - outMin;
  }
  return 0;
}

/**
 * 曜日を取得
 */
export function getDayOfWeek(dateStr: string): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

/**
 * 平日かどうか判定してデフォルト区分を返す
 */
export function getDefaultCategory(dateStr: string): CategoryKey {
  const d = new Date(dateStr);
  const day = d.getDay();
  if (day === 0) return "HOLIDAY";
  return "WORK1";
}

/**
 * 日付文字列に日数を加算（YYYY-MM-DD）
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Excel と同様の閾値: 9時間を超えると NG（元式 IF(S>9/24,...) は時間単位で 9 時間として扱う） */
export const DRIVING_JUDGMENT_THRESHOLD_HOURS = 9;

export interface AvgDrivingResult {
  avgDrivingUpper: number | null; // 列Q 対上行 = 前日の運転時間
  avgDrivingLower: number | null; // 列R 対下行 = 当日と翌日の平均
  avgDrivingMin: number | null;   // 列S = min(Q,R)
  drivingJudgment: string | null;  // 列T OK | NG
}

/**
 * 前日・当日・翌日の運転時間から Q,R,S,T を算出
 * - Q: 前日の運転時間のみ（1日分の値）
 * - R: (当日 + 翌日) / 2、翌日がなければ当日のみ
 * - S: min(Q, R)（片方だけならその値）
 * - T: S > 9 なら NG、それ以外 OK
 */
export function computeAvgDrivingMetrics(
  prevDriving: number | null | undefined,
  currDriving: number | null | undefined,
  nextDriving: number | null | undefined
): AvgDrivingResult {
  const q =
    prevDriving != null && !Number.isNaN(prevDriving) ? prevDriving : null;
  const curr = currDriving != null && !Number.isNaN(currDriving) ? currDriving : null;
  const next = nextDriving != null && !Number.isNaN(nextDriving) ? nextDriving : null;

  let r: number | null = null;
  if (curr != null) {
    r = next != null ? Math.round(((curr + next) / 2) * 100) / 100 : curr;
  }

  let s: number | null = null;
  if (q != null && r != null) {
    s = Math.min(q, r);
  } else if (q != null) {
    s = q;
  } else if (r != null) {
    s = r;
  }

  let drivingJudgment: string | null = null;
  if (s != null) {
    drivingJudgment = s > DRIVING_JUDGMENT_THRESHOLD_HOURS ? "NG" : "OK";
  }

  return {
    avgDrivingUpper: q != null ? Math.round(q * 100) / 100 : null,
    avgDrivingLower: r != null ? Math.round(r * 100) / 100 : null,
    avgDrivingMin: s != null ? Math.round(s * 100) / 100 : null,
    drivingJudgment,
  };
}
