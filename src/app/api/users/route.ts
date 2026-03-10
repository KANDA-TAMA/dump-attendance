import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "true";
  const roleFilter = searchParams.get("role"); // 例: DRIVER（社員欄は運転手のみ表示）

  const where: { isActive?: boolean; role?: string } = includeInactive ? {} : { isActive: true };
  if (roleFilter) where.role = roleFilter;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, employeeId: true, name: true, role: true,
      phone: true, licenseNumber: true, email: true, isActive: true,
      createdAt: true,
    },
    orderBy: { employeeId: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await req.json();
  const { employeeId, name, role, phone, licenseNumber, email, password } = body;

  if (!employeeId || !name || !password) {
    return NextResponse.json({ error: "社員番号・氏名・パスワードは必須です" }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { employeeId } });
    if (existing) {
      return NextResponse.json({ error: "この社員番号は既に使用されています" }, { status: 409 });
    }

    const hashedPassword = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        employeeId,
        name,
        role: role || "DRIVER",
        phone: phone || null,
        licenseNumber: licenseNumber || null,
        email: email || null,
        password: hashedPassword,
      },
      select: {
        id: true, employeeId: true, name: true, role: true,
        phone: true, licenseNumber: true, email: true, isActive: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("User create error:", error);
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
