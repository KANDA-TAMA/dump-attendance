import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<string, string> = {
  WORK1: "出勤①",
  WORK2: "出勤②",
  LEGAL_HOLIDAY: "法定休日出勤",
  PRESCRIBED_HOLIDAY: "所定休日出勤",
  PAID_LEAVE: "有給",
  AM_LEAVE: "午前有給",
  PM_LEAVE: "午後有給",
  ABSENT: "欠勤",
  HOLIDAY: "休日",
  SPECIAL_LEAVE: "特休",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const todayDisplay = format(new Date(), "yyyy年M月d日(E)", { locale: ja });

  const todayAttendance = await prisma.attendance.findUnique({
    where: {
      userId_date: { userId: session.user.id, date: today },
    },
  });

  // 今月10日締め期間のデータ
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}-11`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-10`;

  const monthAttendances = await prisma.attendance.findMany({
    where: {
      userId: session.user.id,
      date: { gte: startDate, lte: endDate },
    },
  });

  const workDays = monthAttendances.filter((a) =>
    ["WORK1", "WORK2", "LEGAL_HOLIDAY", "PRESCRIBED_HOLIDAY"].includes(a.category)
  ).length;
  const totalActual = monthAttendances.reduce((s, a) => s + a.actualHours, 0);
  const totalOvertime = monthAttendances.reduce((s, a) => s + a.overtimeHours, 0);
  const totalDriving = monthAttendances.reduce((s, a) => s + a.drivingHours, 0);
  const pendingCount = monthAttendances.filter((a) => a.approvalStatus === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground">{todayDisplay}</p>
      </div>

      {/* 本日の状況 */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>本日のステータス</CardDescription>
        </CardHeader>
        <CardContent>
          {todayAttendance ? (
            <div className="flex items-center gap-4">
              <Badge>{CATEGORY_LABELS[todayAttendance.category] || todayAttendance.category}</Badge>
              <span className="text-sm">
                出勤: {todayAttendance.clockInRaw || "--:--"} → 退勤: {todayAttendance.clockOutRaw || "--:--"}
              </span>
              <Badge variant={todayAttendance.approvalStatus === "APPROVED" ? "default" : "outline"}>
                {todayAttendance.approvalStatus === "APPROVED" ? "承認済" : todayAttendance.approvalStatus === "REJECTED" ? "差戻し" : "未承認"}
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground">未入力</p>
          )}
        </CardContent>
      </Card>

      {/* 月次サマリー */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>出勤日数</CardDescription>
            <CardTitle className="text-3xl">{workDays}日</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>実働時間合計</CardDescription>
            <CardTitle className="text-3xl">{totalActual.toFixed(1)}h</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>残業時間合計</CardDescription>
            <CardTitle className="text-3xl">{totalOvertime.toFixed(1)}h</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>運転時間合計</CardDescription>
            <CardTitle className="text-3xl">{totalDriving.toFixed(1)}h</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-amber-800">
              未承認の勤怠が <strong>{pendingCount}件</strong> あります
            </p>
          </CardContent>
        </Card>
      )}

      {/* ユーザー情報 & 管理者メニュー */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>ログインユーザー</CardDescription>
          <CardTitle>{session.user.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            社員番号: {session.user.employeeId} / 権限: {session.user.role}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            集計期間: {startDate} 〜 {endDate}（10日締め）
          </p>
        </CardContent>
      </Card>

      {(session.user.role === "ADMIN" || session.user.role === "MANAGER") && (
        <Card>
          <CardHeader>
            <CardTitle>管理者メニュー</CardTitle>
            <CardDescription>管理者・運行管理者専用の機能</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <a href="/dashboard/admin/approval" className="rounded-lg border p-4 text-center transition-colors hover:bg-muted">
              <span className="text-2xl">✅</span>
              <p className="mt-1 text-sm font-medium">勤怠承認</p>
            </a>
            <a href="/dashboard/admin/employees" className="rounded-lg border p-4 text-center transition-colors hover:bg-muted">
              <span className="text-2xl">👥</span>
              <p className="mt-1 text-sm font-medium">社員管理</p>
            </a>
            <a href="/dashboard/admin/settings" className="rounded-lg border p-4 text-center transition-colors hover:bg-muted">
              <span className="text-2xl">⚙️</span>
              <p className="mt-1 text-sm font-medium">設定</p>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
