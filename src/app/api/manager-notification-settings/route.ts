import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const delegate = prisma.managerNotificationSetting;
  if (!delegate) {
    return NextResponse.json(
      { error: "Prismaクライアントが古い可能性があります。開発サーバーを停止し、npx prisma generate を実行してから再起動してください。" },
      { status: 500 }
    );
  }
  const settings = await delegate.findMany({
    include: { user: { select: { name: true, employeeId: true } } },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let body: { userId?: string; email?: string; priority?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }
  const { userId, email, priority } = body;

  if (!userId || !email?.trim()) {
    return NextResponse.json({ error: "運行管理者とメールアドレスは必須です" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "指定ユーザーは運行管理者ではありません" }, { status: 400 });
  }

  const delegate = prisma.managerNotificationSetting;
  if (!delegate) {
    return NextResponse.json(
      { error: "Prismaクライアントが古い可能性があります。開発サーバーを停止し、npx prisma generate を実行してから再起動してください。" },
      { status: 500 }
    );
  }
  try {
    const setting = await delegate.upsert({
      where: { userId },
      update: { email: email.trim(), priority: priority ?? 1 },
      create: {
        userId,
        email: email.trim(),
        priority: priority ?? 1,
      },
      include: { user: { select: { name: true, employeeId: true } } },
    });
    return NextResponse.json(setting);
  } catch (error) {
    console.error("Manager notification setting error:", error);
    const message = error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userIdが必要です" }, { status: 400 });
  }

  const delegate = prisma.managerNotificationSetting;
  if (!delegate) {
    return NextResponse.json(
      { error: "Prismaクライアントが古い可能性があります。開発サーバーを停止し、npx prisma generate を実行してから再起動してください。" },
      { status: 500 }
    );
  }
  try {
    await delegate.deleteMany({
      where: { userId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete manager notification setting error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
