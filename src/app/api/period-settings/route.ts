import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 締め月ごとの対象期間一覧を取得（管理者のみ） */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  try {
    const where: { year?: number; month?: number } = {};
    if (yearParam) where.year = parseInt(yearParam, 10);
    if (monthParam) where.month = parseInt(monthParam, 10);

    const list = await prisma.periodSetting.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Period settings fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

/** YYYY-MM-DD に正規化（MM/DD/YYYY 等も受け付ける） */
function normalizeDateStr(val: unknown): string | null {
  if (typeof val !== "string" || !val.trim()) return null;
  const s = val.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, a, b, y] = m;
    return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }
  return null;
}

/** 締め月ごとの対象期間を登録・更新（管理者のみ） */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const yearNum = typeof b?.year === "number" ? b.year : parseInt(String(b?.year ?? ""), 10);
  const monthNum = typeof b?.month === "number" ? b.month : parseInt(String(b?.month ?? ""), 10);
  const startDate = normalizeDateStr(b?.startDate) ?? (typeof b?.startDate === "string" ? b.startDate.trim() || null : null);
  const endDate = normalizeDateStr(b?.endDate) ?? (typeof b?.endDate === "string" ? b.endDate.trim() || null : null);

  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json({ error: "年は 2000〜2100 の範囲で指定してください" }, { status: 400 });
  }
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return NextResponse.json({ error: "月は 1〜12 の範囲で指定してください" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "開始日・終了日を正しい形式（YYYY-MM-DD）で入力してください" }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: "開始日は終了日以前にしてください" }, { status: 400 });
  }

  try {
    const created = await prisma.periodSetting.upsert({
      where: { year_month: { year: yearNum, month: monthNum } },
      update: { startDate, endDate },
      create: { year: yearNum, month: monthNum, startDate, endDate },
    });

    return NextResponse.json(created);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Period setting upsert error:", error);
    return NextResponse.json(
      { error: `保存に失敗しました: ${msg}` },
      { status: 500 }
    );
  }
}

/** 締め月ごとの対象期間を削除（管理者のみ） */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || "", 10);
  const month = parseInt(searchParams.get("month") || "", 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "year, month を正しく指定してください" },
      { status: 400 }
    );
  }

  try {
    await prisma.periodSetting.delete({
      where: { year_month: { year, month } },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    // レコードが存在しない場合
    return NextResponse.json({ success: true });
  }
}
