import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  const holidays = await prisma.holiday.findMany({
    where: { date: { startsWith: year } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(holidays);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await req.json();
  const { date, name, holidayType } = body;

  if (!date || !name) {
    return NextResponse.json({ error: "日付と名称は必須です" }, { status: 400 });
  }

  try {
    const holiday = await prisma.holiday.upsert({
      where: { date },
      update: { name, holidayType: holidayType || "LEGAL" },
      create: { date, name, holidayType: holidayType || "LEGAL" },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    console.error("Holiday create error:", error);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
