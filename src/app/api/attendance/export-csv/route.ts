import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodForClosingMonth } from "@/lib/period-utils";

// 平日/休日区分（汎用ソフト互換）
// 0 = 平日（通常勤務日）
// 1 = 法定休日（日曜）
// 2 = 所定休日（土曜・祝日など）
function getDayTypeCode(category: string, dateStr: string): number {
  if (category === "LEGAL_HOLIDAY") return 1;
  if (category === "PRESCRIBED_HOLIDAY") return 2;
  if (category === "HOLIDAY") {
    // 日曜なら法定休日(1)、それ以外は所定休日(2)
    const d = new Date(dateStr + "T00:00:00");
    return d.getDay() === 0 ? 1 : 2;
  }
  return 0;
}

// 法定休日出勤の実働時間 → Z列（休１時間）
function getLegalHolidayHours(category: string, actualHours: number): number {
  return category === "LEGAL_HOLIDAY" ? actualHours : 0;
}

// 所定休日出勤の実働時間 → AB列（休２時間）
function getPrescribedHolidayHours(category: string, actualHours: number): number {
  return category === "PRESCRIBED_HOLIDAY" ? actualHours : 0;
}

// 遅早時間（遅刻+早退を時間単位に変換）→ AD列
function getLateEarlyHours(lateMinutes: number, earlyLeaveMinutes: number): number {
  const total = lateMinutes + earlyLeaveMinutes;
  return total > 0 ? Math.round(total / 60 * 10) / 10 : 0;
}

// 不在理由
function getAbsenceReason(category: string): string | null {
  const map: Record<string, string> = {
    PAID_LEAVE: "有休",
    AM_LEAVE: "午前有休",
    PM_LEAVE: "午後有休",
    ABSENT: "欠勤",
    SPECIAL_LEAVE: "特休",
  };
  return map[category] ?? null;
}

// 所定内時間
function getPrescribedHours(category: string): number {
  if (["WORK1", "WORK2", "PAID_LEAVE", "SPECIAL_LEAVE"].includes(category)) return 8;
  if (["AM_LEAVE", "PM_LEAVE"].includes(category)) return 4;
  return 0;
}

// 時刻文字列 "HH:mm" をCSV用にフォーマット（そのまま返す）
function formatTime(time: string | null): string {
  return time ?? "";
}

// 日付を YYYY/MM/DD 形式に変換
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

  const isAll = userIdParam === "ALL" || !userIdParam;

  let startDate: string;
  let endDate: string;
  try {
    const period = await getPeriodForClosingMonth(prisma, year, month);
    startDate = period.startDate;
    endDate = period.endDate;
  } catch {
    return NextResponse.json({ error: "期間の取得に失敗しました" }, { status: 500 });
  }

  const where: Record<string, unknown> = {
    date: { gte: startDate, lte: endDate },
  };
  if (!isAll && userIdParam) {
    where.userId = userIdParam;
  } else {
    where.user = { role: "DRIVER" };
  }

  const attendances = await prisma.attendance.findMany({
    where,
    orderBy: [{ userId: "asc" }, { date: "asc" }],
    include: {
      user: {
        select: { name: true, employeeId: true, cardNumber: true },
      },
    },
  });

  // ヘッダー行（汎用ソフト「data貼付場所」シートと同一列構成）
  const headers = [
    "カード番号",
    "従業員番号",
    "従業員氏名",
    "所属番号",
    "年/月/日",
    "シフト番号",
    "平日/休日区分",
    "不在理由",
    "出勤打刻",
    "出勤マーク",
    "外出打刻",
    "外出マーク",
    "戻打刻",
    "戻マーク",
    "退勤打刻",
    "退勤マーク",
    "例外１",
    "例外マーク",
    "例外２",
    "例外２マーク",
    "所定内時間",
    "延長時間",
    "早出残業",
    "深夜時間",
    "深夜残業",
    "休１時間",
    "休１深夜",
    "休２時間",
    "休２深夜",
    "遅早時間",
    "外出時間",
    "コメント",
  ];

  const rows: string[][] = [headers];

  for (const a of attendances) {
    const dayTypeCode = getDayTypeCode(a.category, a.date);
    const absenceReason = getAbsenceReason(a.category);
    const prescribedHours = getPrescribedHours(a.category);
    const earlyOT = a.earlyOvertimeHours ?? 0;
    const legalHolidayH = getLegalHolidayHours(a.category, a.actualHours);
    const prescHolidayH = getPrescribedHolidayHours(a.category, a.actualHours);
    const lateEarlyH = getLateEarlyHours(a.lateMinutes ?? 0, a.earlyLeaveMinutes ?? 0);

    const row: (string | number | null)[] = [
      a.user.cardNumber ?? "",          // カード番号
      a.user.employeeId,                 // 従業員番号
      a.user.name,                       // 従業員氏名
      "",                                // 所属番号（空白）
      formatDate(a.date),               // 年/月/日
      8,                                 // シフト番号（固定）
      dayTypeCode,                       // 平日/休日区分
      absenceReason ?? "",              // 不在理由
      formatTime(a.clockInRaw),         // 出勤打刻
      0,                                 // 出勤マーク
      "",                                // 外出打刻
      0,                                 // 外出マーク
      "",                                // 戻打刻
      0,                                 // 戻マーク
      formatTime(a.clockOutRaw),        // 退勤打刻
      0,                                 // 退勤マーク
      "",                                // 例外１
      0,                                 // 例外マーク
      "",                                // 例外２
      0,                                 // 例外２マーク
      prescribedHours,                   // 所定内時間
      0,                                 // 延長時間（汎用ソフト未使用）
      earlyOT,                           // 早出残業
      0,                                 // 深夜時間
      0,                                 // 深夜残業
      legalHolidayH,                     // 休１時間（法定休日の実働時間）
      0,                                 // 休１深夜
      prescHolidayH,                     // 休２時間（所定休日の実働時間）
      0,                                 // 休２深夜
      lateEarlyH,                        // 遅早時間
      0,                                 // 外出時間
      a.note ?? "",                      // コメント
    ];

    rows.push(row.map((v) => (v === null ? "" : String(v))));
  }

  // CSV文字列生成（Shift-JIS用 BOM なし、カンマ区切り）
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          // カンマ・改行・ダブルクォートを含む場合はダブルクォートで囲む
          if (cell.includes(",") || cell.includes("\n") || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    )
    .join("\r\n");

  // UTF-8 BOM付きで出力（Excel で文字化けしないよう）
  const bom = "\uFEFF";
  const filename = `勤怠data_${year}年${month}月締め.csv`;

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
