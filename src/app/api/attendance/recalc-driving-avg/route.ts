import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  syncDrivingAvgForUser,
  syncDrivingAvgAllUsers,
} from "@/lib/driving-avg-sync";

/**
 * Q/R/S/T（平均下限・判定）をDBに書き直す。
 * 既存データが null のままのときに実行する。
 *
 * POST body: {} → 自分のみ
 * POST body: { userId } → 管理者が指定ユーザー（運転手）のみ
 * POST body: { all: true } → 管理者が全件（重い）
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let body: { userId?: string; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  try {
    if (body.all === true) {
      if (!isAdmin) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      const count = await syncDrivingAvgAllUsers();
      return NextResponse.json({ ok: true, updated: count, scope: "all" });
    }

    const userId = body.userId && isAdmin ? body.userId : session.user.id;
    const count = await syncDrivingAvgForUser(userId);
    return NextResponse.json({ ok: true, updated: count, scope: "user", userId });
  } catch (e) {
    console.error("recalc-driving-avg", e);
    return NextResponse.json({ error: "再計算に失敗しました" }, { status: 500 });
  }
}
