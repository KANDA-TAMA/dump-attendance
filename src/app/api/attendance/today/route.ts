import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date,
      },
    },
  });

  return NextResponse.json(attendance ?? null);
}
