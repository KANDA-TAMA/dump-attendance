import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format, subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RecalcDrivingAvgButton } from "@/components/recalc-driving-avg-button";

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

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const attendances = await prisma.attendance.findMany({
    where: {
      userId: session.user.id,
      date: { gte: thirtyDaysAgo, lte: today },
    },
    orderBy: { date: "desc" },
  });

  const approvalBadge = (status: string) => {
    if (status === "APPROVED") return <Badge>承認済</Badge>;
    if (status === "REJECTED") return <Badge variant="destructive">差戻し</Badge>;
    return <Badge variant="outline">未承認</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">勤怠一覧</h1>
          <p className="text-muted-foreground">過去30日間の出勤簿</p>
        </div>
        <RecalcDrivingAvgButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>勤怠履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {attendances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              勤怠記録がありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">日付</TableHead>
                    <TableHead>曜日</TableHead>
                    <TableHead>区分</TableHead>
                    <TableHead>出勤</TableHead>
                    <TableHead>退勤</TableHead>
                    <TableHead>実働</TableHead>
                    <TableHead>運転</TableHead>
                    <TableHead>荷役</TableHead>
                    <TableHead>残業</TableHead>
                    <TableHead className="whitespace-nowrap" title="Excel列S: min(Q,R)">平均下限</TableHead>
                    <TableHead className="whitespace-nowrap" title="Excel列T: S>9h→NG">判定</TableHead>
                    <TableHead>承認</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {a.date}
                      </TableCell>
                      <TableCell>{a.dayOfWeek || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[a.category] || a.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{a.clockInRounded || "--:--"}</TableCell>
                      <TableCell>{a.clockOutRounded || "--:--"}</TableCell>
                      <TableCell>{a.actualHours > 0 ? `${a.actualHours}h` : "-"}</TableCell>
                      <TableCell>{a.drivingHours > 0 ? `${a.drivingHours}h` : "-"}</TableCell>
                      <TableCell>{a.loadingHours > 0 ? `${a.loadingHours}h` : "-"}</TableCell>
                      <TableCell>{a.overtimeHours > 0 ? `${a.overtimeHours}h` : "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {typeof a.avgDrivingMin === "number" && !Number.isNaN(a.avgDrivingMin)
                          ? a.avgDrivingMin
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {a.drivingJudgment === "NG" ? (
                          <Badge variant="destructive">NG</Badge>
                        ) : a.drivingJudgment === "OK" ? (
                          <Badge className="bg-green-600">OK</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{approvalBadge(a.approvalStatus)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
