import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import ExcelJS from "exceljs";
import path from "path";
import JSZip from "jszip";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodForClosingMonth } from "@/lib/period-utils";

const CATEGORY_LABELS: Record<string, string> = {
  WORK1: "出勤①",
  WORK2: "出勤②",
  LEGAL_HOLIDAY: "法定休日",
  PRESCRIBED_HOLIDAY: "所定休日",
  PAID_LEAVE: "有給",
  AM_LEAVE: "午前有給",
  PM_LEAVE: "午後有給",
  ABSENT: "欠勤",
  HOLIDAY: "休日",
  SPECIAL_LEAVE: "特休",
};

/** 休憩時間を入れない区分（休日・有給・欠勤・特休など） */
const NO_BREAK_CATEGORIES = ["HOLIDAY", "PAID_LEAVE", "AM_LEAVE", "PM_LEAVE", "ABSENT", "SPECIAL_LEAVE"];

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "出勤簿_template.xlsx");

/** YYYY-MM-DD を Excel シリアル日付に変換（日付のみ）。
 *  Excel の「1900年日付システム」は 1899-12-30 を 0 とみなす歴史的仕様があるため、
 *  それに合わせて 1899-12-30 との差分日数をそのままシリアル値として返す。
 *  （0 時固定＋Math.floor でタイムゾーンや丸め誤差によるズレを防ぐ）
 */
function dateToExcelSerial(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899 → Excel serial 1 = Jan 1, 1900（Excel の仕様に合わせる）
  return Math.floor((d.getTime() - epoch.getTime()) / 86400000);
}

/** HH:mm を Excel 時刻（0〜1の小数）に変換 */
function timeToExcelDecimal(timeStr: string | null): number | "" {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  return (h * 60 + m) / (24 * 60);
}

/** 分を時間（小数）に変換 */
function minutesToHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

/** 時間（時間単位）をExcel [h]:mm用の日割り小数に変換（1分単位に丸め） */
function hoursToExcelTime(hours: number): number {
  // 1時間=60分 → 「分」に変換して1分単位に丸め、Excel のシリアル（日単位）に戻す
  const minutes = Math.round(hours * 60); // 1分単位に丸め
  return minutes / (24 * 60);
}

/** 期間内の全日付を生成（startDate〜endDate は API で決定、10日締め以外にも対応可能） */
function getPeriodDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** シート上のテーブルをすべて削除（ExcelJS + テーブルで sheet1.xml 破損しやすい） */
function stripWorksheetTables(ws: ExcelJS.Worksheet): void {
  try {
    const tables = ws.getTables?.();
    if (Array.isArray(tables)) {
      for (const t of tables) {
        const name = (t as { name?: string })?.name;
        if (name) ws.removeTable(name);
      }
    }
  } catch {
    /* getTables の戻り仕様が環境で異なる場合 */
  }
  (ws as ExcelJS.Worksheet & { autoFilter?: unknown }).autoFilter = undefined;
}

/**
 * データ 11〜41 行。合計ブロックは行削除しないテンプレに合わせ 48 行目〜配置
 * （43→48, 44→49 … と +5 行ずらすと形式・転記内容が整合する）
 */
const FIXED_DATA_LAST_ROW = 41;
/** 出勤日数・残業時間などのブロック開始行（元テンプレの 48 行相当） */
const FIXED_SUMMARY_START_ROW = 48;

/** 氏名シート以外を削除（関数・祝日一覧・改定内容などテンプレ付属シートを出力に含めない） */
function removeSheetsExcept(wb: ExcelJS.Workbook, keepSheetName: string): void {
  const safeKeep = keepSheetName.replace(/[/\\?*:\[\]]/g, "_").slice(0, 31);
  const names = wb.worksheets.map((s) => s.name);
  for (const name of names) {
    if (name !== safeKeep) {
      wb.removeWorksheet(name);
    }
  }
}

/** 指定範囲の行の非表示を解除（元ファイル同様、全行表示で出力） */
function ensureRowsVisible(ws: ExcelJS.Worksheet, fromRow: number, toRow: number): void {
  for (let r = fromRow; r <= toRow; r++) {
    const row = ws.getRow(r);
    row.hidden = false;
    if (row.outlineLevel != null) row.outlineLevel = 0;
  }
}

/** 行のセルを値なしでクリア（数式・値を除去して XML 不整合を防ぐ） */
function clearRowCells(ws: ExcelJS.Worksheet, rowNum: number, colFrom = 1, colTo = 20): void {
  const row = ws.getRow(rowNum);
  for (let c = colFrom; c <= colTo; c++) {
    const cell = row.getCell(c);
    cell.value = null;
    delete (cell as { formula?: string }).formula;
  }
}

interface AttendanceRow {
  id: string;
  date: string;
  dayOfWeek: string | null;
  category: string;
  clockInRaw: string | null;
  clockOutRaw: string | null;
  clockInRounded: string | null;
  clockOutRounded: string | null;
  drivingHours: number;
  loadingHours: number;
  breakHours: number;
  actualHours: number;
  overtimeHours: number;
  earlyOvertimeHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  approvalStatus: string;
  note: string | null;
  avgDrivingMin?: number | null;
  drivingJudgment?: string | null;
  avgDrivingUpper?: number | null;
  avgDrivingLower?: number | null;
  user?: { name: string; employeeId: string };
}

/**
 * startDate / endDate に完全依存したシート構築。
 * - データ行数 = 期間の日数
 * - 合計行はデータ最終行の2行下から配置（どの月・何日でも同じ構造）
 */
function buildSheetFromTemplate(
  wb: ExcelJS.Workbook,
  attendances: AttendanceRow[],
  userName: string,
  sheetName: string,
  startDate: string,
  endDate: string
): void {
  const startSerial = dateToExcelSerial(startDate);
  const endSerial = dateToExcelSerial(endDate);
  const periodDates = getPeriodDates(startDate, endDate);
  const periodDays = periodDates.length;

  const ws = wb.getWorksheet("出勤簿");
  if (!ws) throw new Error("テンプレートに「出勤簿」シートがありません");

  // 破損対策: 条件付き書式・オートフィルタ・テーブルを除去
  const wsAny = ws as { conditionalFormattings?: unknown[] };
  wsAny.conditionalFormattings = [];
  stripWorksheetTables(ws);

  ws.name = sheetName.replace(/[/\\?*:\[\]]/g, "_").slice(0, 31);

  // L2: 開始日・L4: 締日（必ず API で取得した startDate/endDate と一致させる。テンプレの数式を消してから設定）
  const l2 = ws.getCell("L2");
  const l4 = ws.getCell("L4");
  delete (l2 as { formula?: string }).formula;
  delete (l4 as { formula?: string }).formula;
  l2.value = startSerial;
  l2.numFmt = "yyyy/m/d";
  l4.value = endSerial;
  l4.numFmt = "yyyy/m/d";

  ws.getCell("K8").value = null;
  ws.getCell("L8").value = "氏名";
  ws.getCell("M8").value = userName;

  const DATA_START_ROW = 11;
  const TEMPLATE_DATA_ROWS = 31;
  const MAX_CLEAR_ROW = 120;

  // 31日超の期間のみ行複製（10日締めは最大31日のため通常は固定レイアウト）
  if (periodDays > TEMPLATE_DATA_ROWS) {
    const toInsert = periodDays - TEMPLATE_DATA_ROWS;
    const lastTemplateRow = DATA_START_ROW + TEMPLATE_DATA_ROWS - 1;
    ws.duplicateRow(lastTemplateRow, toInsert, true);
  }

  // データ 11〜41、合計は 48 行目〜（43〜47 はテンプレのまま残す／上書きしない）
  const useFixedLayout = periodDays <= TEMPLATE_DATA_ROWS;
  const lastDataRow = useFixedLayout ? FIXED_DATA_LAST_ROW : DATA_START_ROW + periodDays - 1;
  const summaryBaseRow = useFixedLayout ? FIXED_SUMMARY_START_ROW : DATA_START_ROW + periodDays + 1;

  // 固定レイアウト時: 42〜47 行をクリア（テンプレの共有数式クローンが A42 等に残ると writeBuffer でエラーになる）
  // 合計は 48 行目〜なので 42〜47 は空行で問題なし
  if (useFixedLayout) {
    for (let r = FIXED_DATA_LAST_ROW + 1; r < FIXED_SUMMARY_START_ROW; r++) {
      clearRowCells(ws, r);
    }
    for (let r = summaryBaseRow + 7; r <= MAX_CLEAR_ROW; r++) {
      clearRowCells(ws, r);
    }
  } else {
    for (let r = DATA_START_ROW + periodDays; r <= MAX_CLEAR_ROW; r++) {
      clearRowCells(ws, r);
    }
  }

  const attendanceByDate = new Map<string, AttendanceRow>();
  for (const a of attendances) {
    attendanceByDate.set(a.date, a);
  }

  // データ行
  for (let i = 0; i < periodDates.length; i++) {
    const dateStr = periodDates[i];
    const a = attendanceByDate.get(dateStr);
    const rowNum = DATA_START_ROW + i;
    const row = ws.getRow(rowNum);
    const serial = dateToExcelSerial(dateStr);

    row.getCell(1).value = serial;
    row.getCell(1).numFmt = "d";
    row.getCell(2).value = serial;
    row.getCell(2).numFmt = "aaa";
    row.getCell(3).value = a ? (CATEGORY_LABELS[a.category] || a.category) : "";

    if (a) {
      const clockInDec = timeToExcelDecimal(a.clockInRounded);
      const clockOutDec = timeToExcelDecimal(a.clockOutRounded);
      const lateH = a.lateMinutes > 0 ? minutesToHours(a.lateMinutes) : null;
      const earlyH = a.earlyLeaveMinutes > 0 ? minutesToHours(a.earlyLeaveMinutes) : null;
      const isNoBreakDay = NO_BREAK_CATEGORIES.includes(a.category);

      row.getCell(4).value = clockInDec !== "" ? clockInDec : null;
      row.getCell(5).value = clockOutDec !== "" ? clockOutDec : null;
      row.getCell(6).value = a.drivingHours > 0 ? hoursToExcelTime(a.drivingHours) : null;
      row.getCell(7).value = a.loadingHours > 0 ? hoursToExcelTime(a.loadingHours) : null;
      row.getCell(8).value = isNoBreakDay ? null : (a.breakHours > 0 ? hoursToExcelTime(a.breakHours) : null);
      row.getCell(9).value = a.actualHours > 0 ? hoursToExcelTime(a.actualHours) : null;
      row.getCell(10).value = a.overtimeHours > 0 ? hoursToExcelTime(a.overtimeHours) : null;
      row.getCell(11).value = null;
      row.getCell(12).value = a.earlyOvertimeHours > 0 ? hoursToExcelTime(a.earlyOvertimeHours) : null;
      row.getCell(13).value = lateH !== null ? hoursToExcelTime(lateH) : null;
      row.getCell(14).value = earlyH !== null ? hoursToExcelTime(earlyH) : null;
      row.getCell(15).value = a.note ?? null;
    } else {
      row.getCell(8).value = null;
      for (const c of [4, 5, 6, 7, 9, 10, 11, 12, 13, 14]) {
        row.getCell(c).value = null;
      }
    }

    for (const c of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      row.getCell(c).numFmt = "[h]:mm";
    }
  }

  // 固定レイアウト: 期間が31日未満のとき 11+periodDays〜41 行を空行で揃え（元ファイルの C11:C41 集計と整合）
  const formulaLastRow = useFixedLayout ? FIXED_DATA_LAST_ROW : DATA_START_ROW + periodDays - 1;
  if (useFixedLayout && periodDays < TEMPLATE_DATA_ROWS) {
    for (let r = DATA_START_ROW + periodDays; r <= FIXED_DATA_LAST_ROW; r++) {
      clearRowCells(ws, r);
      const row = ws.getRow(r);
      row.getCell(1).value = null;
      row.getCell(2).value = null;
      row.getCell(3).value = null;
    }
  }

  // Q,R,S,T（平均・判定）— formulaLastRow まで（固定時は 41 行まで）
  for (let r = DATA_START_ROW; r <= formulaLastRow; r++) {
    const row = ws.getRow(r);
    const prev = Math.max(DATA_START_ROW, r - 1);
    const next = Math.min(formulaLastRow, r + 1);
    const qFormula =
      r === DATA_START_ROW
        ? `IF(D${r}="","",AVERAGE(F${r}))`
        : `IF(D${r}="","",AVERAGE(F${prev}:F${r}))`;
    const rFormula =
      r === formulaLastRow
        ? `IF(D${r}="","",AVERAGE(F${r}))`
        : `IF(D${r}="","",AVERAGE(F${r}:F${next}))`;
    row.getCell(17).value = { formula: qFormula };
    row.getCell(18).value = { formula: rFormula };
    row.getCell(19).value = { formula: `MIN(Q${r}:R${r})` };
    row.getCell(20).value = { formula: `IF(S${r}>(9/24),"NG","OK")` };
    row.getCell(17).numFmt = "[h]:mm";
    row.getCell(18).numFmt = "[h]:mm";
    row.getCell(19).numFmt = "[h]:mm";
    row.getCell(20).numFmt = "General";
  }

  // 合計ブロック書き込み前に該当行を丸ごとクリア（テンプレの共有数式クローンが残ると writeBuffer でエラーになる）
  for (let r = summaryBaseRow; r <= summaryBaseRow + 6; r++) {
    clearRowCells(ws, r);
  }

  // 48=出勤日数, 49=休日出勤, 50=有休, 51=実労働, 52=所定内, 53=保管期間, 54=廃棄時期
  const r48 = summaryBaseRow;
  const r49 = summaryBaseRow + 1;
  const r50 = summaryBaseRow + 2;
  const r51 = summaryBaseRow + 3;
  const r52 = summaryBaseRow + 4;
  const r53 = summaryBaseRow + 5;
  const r54 = summaryBaseRow + 6;

  // C11:C41 / J11:J41 で集計（データ最終行 41 固定時）
  const rangeC = `C${DATA_START_ROW}:C${formulaLastRow}`;
  const rangeI = `I${DATA_START_ROW}:I${formulaLastRow}`;
  const rangeJ = `J${DATA_START_ROW}:J${formulaLastRow}`;
  const e50 = `E${r50}`;
  const j50 = `J${r50}`;
  const j51 = `J${r51}`;
  const j52 = `J${r52}`;

  // Row 48: 出勤日数(C-D), E式, 残業時間(G-I), J式, 承認印(L-N) — 44→49, 45→50 … と +5 行で整合
  ws.getRow(r48).getCell(3).value = "出勤日数";
  ws.getRow(r48).getCell(4).value = "出勤日数";
  ws.getRow(r48).getCell(5).value = {
    formula: `COUNTIFS(${rangeC},"出勤①")+COUNTIFS(${rangeC},"出勤②")+COUNTIFS(${rangeC},"法定休日出勤")+COUNTIFS(${rangeC},"所定休日出勤")`,
  };
  ws.getRow(r48).getCell(7).value = "残業時間";
  ws.getRow(r48).getCell(8).value = "残業時間";
  ws.getRow(r48).getCell(9).value = "残業時間";
  ws.getRow(r48).getCell(10).value = { formula: `SUM(${rangeJ})-${j52}` };
  ws.getRow(r48).getCell(12).value = "承認印";
  ws.getRow(r48).getCell(13).value = "承認印";
  ws.getRow(r48).getCell(14).value = "承認印";

  ws.getRow(r49).getCell(3).value = "休日出勤日数";
  ws.getRow(r49).getCell(4).value = "休日出勤日数";
  ws.getRow(r49).getCell(5).value = {
    formula: `COUNTIFS(${rangeC},"法定休日出勤")+COUNTIFS(${rangeC},"所定休日出勤")`,
  };

  ws.getRow(r50).getCell(3).value = "有休取得日数";
  ws.getRow(r50).getCell(4).value = "有休取得日数";
  ws.getRow(r50).getCell(5).value = {
    formula: `COUNTIFS(${rangeC},"有給")+COUNTIFS(${rangeC},"午前有給")*0.5+COUNTIFS(${rangeC},"午後有給")*0.5`,
  };
  ws.getRow(r50).getCell(7).value = "法定休日勤務時間";
  ws.getRow(r50).getCell(8).value = "法定休日勤務時間";
  ws.getRow(r50).getCell(9).value = "法定休日勤務時間";
  ws.getRow(r50).getCell(10).value = { formula: `SUMIF(${rangeC},"法定休日出勤",${rangeI})` };

  ws.getRow(r51).getCell(3).value = "実労働時間";
  ws.getRow(r51).getCell(4).value = "実労働時間";
  ws.getRow(r51).getCell(5).value = {
    formula: `COUNTIF(${rangeC},"出勤①")*8/24+COUNTIF(${rangeC},"出勤②")*8/24-${e50}*8/24+J${r48}`,
  };
  ws.getRow(r51).getCell(7).value = "所定休日勤務時間";
  ws.getRow(r51).getCell(8).value = "所定休日勤務時間";
  ws.getRow(r51).getCell(9).value = "所定休日勤務時間";
  ws.getRow(r51).getCell(10).value = { formula: `SUMIF(${rangeC},"所定休日出勤",${rangeI})` };

  ws.getRow(r52).getCell(3).value = "所定内労働時間";
  ws.getRow(r52).getCell(4).value = "所定内労働時間";
  ws.getRow(r52).getCell(5).value = {
    formula: `COUNTIF(${rangeC},"出勤①")*8/24+COUNTIF(${rangeC},"出勤②")*8/24`,
  };
  ws.getRow(r52).getCell(7).value = "休日勤務時間(合計)";
  ws.getRow(r52).getCell(8).value = "休日勤務時間(合計)";
  ws.getRow(r52).getCell(9).value = "休日勤務時間(合計)";
  ws.getRow(r52).getCell(10).value = { formula: `${j50}+${j51}` };

  // Row 53: 保管期間, Row 54: 廃棄時期（テンプレの M48:O48 / M49:O49 相当位置）
  const discardFormula = "EDATE(L4,60)+1";
  ws.getRow(r53).getCell(12).value = "保管期間";
  ws.getRow(r53).getCell(13).value = "5年";
  ws.getRow(r53).getCell(14).value = "5年";
  ws.getRow(r53).getCell(15).value = "5年";
  ws.getRow(r54).getCell(12).value = "廃棄時期";
  for (const col of [13, 14, 15]) {
    ws.getRow(r54).getCell(col).value = { formula: discardFormula };
    ws.getRow(r54).getCell(col).numFmt = "yyyy/m/d";
  }

  // 元ファイルのセル結合を忠実に再現（テンプレに既存結合があると mergeCells が失敗するため unMerge してから結合）
  const mergeRanges = [
    `C${r48}:D${r48}`,
    `G${r48}:I${r48}`,
    `C${r49}:D${r49}`,
    `C${r50}:D${r50}`,
    `G${r50}:I${r50}`,
    `C${r51}:D${r51}`,
    `G${r51}:I${r51}`,
    `C${r52}:D${r52}`,
    `G${r52}:I${r52}`,
    `L${r49}:L${r50}`,
    `M${r49}:M${r50}`,
    `N${r49}:N${r50}`,
    `M${r53}:O${r53}`,
    `M${r54}:O${r54}`,
  ];
  for (const range of mergeRanges) {
    try {
      ws.unMergeCells(range);
    } catch {
      /* 未結合なら無視 */
    }
    try {
      ws.mergeCells(range);
    } catch {
      /* 結合済み等はスキップ */
    }
  }

  // 元ファイル同様、全行を表示状態にする（テンプレの非表示・アウトラインを解除）
  ensureRowsVisible(ws, 1, Math.max(r54 + 10, 60));
  if (ws.properties) {
    ws.properties.outlineLevelRow = 0;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString(), 10);

  const isAll = userIdParam === "ALL";
  const userId = isAll ? undefined : (userIdParam || session.user.id);

  if (!isAll && userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (isAll && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // 【重要】対象期間は必ず getPeriodForClosingMonth のみ使用。PeriodSetting / CLOSING_DAY を参照し、
  // 締め月ごとの設定または締め日から算出。固定の前月11日〜当月10日等のハードコードは禁止。
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
      where.user = { role: "DRIVER" };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: [{ userId: "asc" }, { date: "asc" }],
      include: {
        user: { select: { name: true, employeeId: true } },
      },
    });

    if (attendances.length === 0) {
      return NextResponse.json({ error: "出力するデータがありません" }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);

    const writeOpts: Parameters<ExcelJS.Workbook["xlsx"]["writeBuffer"]>[0] = {
      useSharedStrings: false,
      useStyles: true,
    };

    if (isAll && attendances.length > 0) {
      const byUser = new Map<string, AttendanceRow[]>();
      for (const a of attendances as AttendanceRow[]) {
        const uid = a.user?.name || "不明";
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid)!.push(a);
      }

      const zip = new JSZip();
      const yy = String(year).slice(-2);
      const mm = String(month).padStart(2, "0");

      for (const [userName, list] of byUser) {
        const userWb = new ExcelJS.Workbook();
        await userWb.xlsx.readFile(TEMPLATE_PATH);
        const sheetName = userName.length > 31 ? userName.slice(0, 28) + "..." : userName;
        buildSheetFromTemplate(userWb, list, userName, sheetName, startDate, endDate);
        removeSheetsExcept(userWb, sheetName);
        const buf = await userWb.xlsx.writeBuffer(writeOpts);
        const safeName = userName.replace(/[/\\?*:\[\]]/g, "_");
        zip.file(`${safeName}出勤簿_${yy}${mm}10(再改定).xlsx`, buf);
      }

      const zipBuf = await zip.generateAsync({ type: "arraybuffer" });
      const filename = encodeURIComponent(`勤怠_${year}年${month}月締め_全員.zip`);

      return new NextResponse(zipBuf, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        },
      });
    }

    const userName = (attendances[0] as AttendanceRow)?.user?.name || "勤怠";
    const singleSheetName = userName.length > 31 ? userName.slice(0, 28) + "..." : userName;
    buildSheetFromTemplate(wb, attendances as AttendanceRow[], userName, singleSheetName, startDate, endDate);
    removeSheetsExcept(wb, singleSheetName);

    const buf = await wb.xlsx.writeBuffer(writeOpts);
    const yy = String(year).slice(-2);
    const mm = String(month).padStart(2, "0");
    const baseName = isAll
      ? `勤怠_${year}年${month}月締め_全員`
      : `${(attendances[0] as AttendanceRow)?.user?.name || "勤怠"}出勤簿_${yy}${mm}10(再改定)`;
    const filename = encodeURIComponent(`${baseName}.xlsx`);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: "Excel出力に失敗しました" }, { status: 500 });
  }
}
