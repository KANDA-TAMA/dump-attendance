"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

const WORK_CATEGORIES = ["WORK1", "WORK2", "LEGAL_HOLIDAY", "PRESCRIBED_HOLIDAY"];

interface Attendance {
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
  user?: { name: string; employeeId: string };
}

interface MonthlyData {
  period: { startDate: string; endDate: string; year: number; month: number };
  attendances: Attendance[];
}

function calcTotals(attendances: Attendance[]) {
  return attendances.reduce(
    (acc, a) => ({
      workDays: acc.workDays + (WORK_CATEGORIES.includes(a.category) ? 1 : 0),
      actual: acc.actual + a.actualHours,
      driving: acc.driving + a.drivingHours,
      loading: acc.loading + a.loadingHours,
      breakH: acc.breakH + a.breakHours,
      overtime: acc.overtime + a.overtimeHours,
      earlyOvertime: acc.earlyOvertime + a.earlyOvertimeHours,
      lateMinutes: acc.lateMinutes + a.lateMinutes,
      earlyLeaveMinutes: acc.earlyLeaveMinutes + a.earlyLeaveMinutes,
      paidLeave: acc.paidLeave + (["PAID_LEAVE", "AM_LEAVE", "PM_LEAVE"].includes(a.category) ? (a.category === "PAID_LEAVE" ? 1 : 0.5) : 0),
      legalHoliday: acc.legalHoliday + (a.category === "LEGAL_HOLIDAY" ? 1 : 0),
      prescribedHoliday: acc.prescribedHoliday + (a.category === "PRESCRIBED_HOLIDAY" ? 1 : 0),
      absent: acc.absent + (a.category === "ABSENT" ? 1 : 0),
      lateDays: acc.lateDays + (a.lateMinutes > 0 ? 1 : 0),
      earlyLeaveDays: acc.earlyLeaveDays + (a.earlyLeaveMinutes > 0 ? 1 : 0),
    }),
    {
      workDays: 0, actual: 0, driving: 0, loading: 0, breakH: 0,
      overtime: 0, earlyOvertime: 0, lateMinutes: 0, earlyLeaveMinutes: 0,
      paidLeave: 0, legalHoliday: 0, prescribedHoliday: 0, absent: 0,
      lateDays: 0, earlyLeaveDays: 0,
    }
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface UserOption {
  id: string;
  employeeId: string;
  name: string;
  role: string;
}

export default function MonthlyPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);

  const canSelectUser = users.length > 0;
  const isAllView = selectedUserId === "ALL";

  useEffect(() => {
    fetch("/api/users?role=DRIVER")
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((list) => {
        setUsers(list);
        if (list.length > 0 && !selectedUserId) setSelectedUserId("ALL");
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
      if (canSelectUser && selectedUserId) params.set("userId", selectedUserId);
      const res = await fetch(`/api/attendance/monthly?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, selectedUserId]);

  const handleExportExcel = async () => {
    if (!data || data.attendances.length === 0) return;
    const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
    if (canSelectUser && selectedUserId) params.set("userId", selectedUserId);
    try {
      const res = await fetch(`/api/attendance/monthly/export-excel?${params}`);
      if (!res.ok) throw new Error("出力に失敗しました");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename\*=UTF-8''(.+)/);
      const filename = match ? decodeURIComponent(match[1]) : `勤怠_${year}年${month}月締め.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Excel出力に失敗しました");
    }
  };

  const totals = data ? calcTotals(data.attendances) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">月次集計</h1>
        <p className="text-muted-foreground">10日締めの月次勤怠データ</p>
      </div>

      {/* 期間・社員選択 */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          {canSelectUser && (
            <div className="space-y-1">
              <label className="text-sm font-medium">表示対象</label>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="ALL">運転手全員</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">年</label>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={year.toString()}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y.toString()}>{y}年</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">月（締め月）</label>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={month.toString()}
              onChange={(e) => setMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m.toString()}>{m}月</option>
              ))}
            </select>
          </div>
          <RecalcDrivingAvgButton />
          <Button variant="outline" onClick={handleExportExcel} disabled={!data || data.attendances.length === 0}>
            📥 Excel出力
          </Button>
        </CardContent>
      </Card>

      {loading && <p className="text-center text-muted-foreground">読み込み中...</p>}

      {data && (
        <>
          {/* サマリーカード */}
          <Card>
            <CardHeader>
              <CardTitle>
                {data.period.year}年{data.period.month}月締め サマリー
              </CardTitle>
              <CardDescription>
                期間: {data.period.startDate} 〜 {data.period.endDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totals && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground">出勤日数</p>
                    <p className="text-2xl font-bold">{totals.workDays}<span className="text-sm">日</span></p>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground">実働合計</p>
                    <p className="text-2xl font-bold">{totals.actual.toFixed(1)}<span className="text-sm">h</span></p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">運転合計</p>
                    <p className="text-2xl font-bold">{totals.driving.toFixed(1)}<span className="text-sm">h</span></p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">荷役合計</p>
                    <p className="text-2xl font-bold">{totals.loading.toFixed(1)}<span className="text-sm">h</span></p>
                  </div>
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground">残業合計</p>
                    <p className="text-2xl font-bold">{totals.overtime.toFixed(1)}<span className="text-sm">h</span></p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${totals.earlyOvertime > 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"}`}>
                    <p className="text-xs text-muted-foreground">早朝残業合計</p>
                    <p className="text-2xl font-bold">{totals.earlyOvertime.toFixed(1)}<span className="text-sm">h</span></p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${totals.lateDays > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"}`}>
                    <p className="text-xs text-muted-foreground">遅刻</p>
                    <p className="text-lg font-bold">{totals.lateDays}<span className="text-sm">回</span> / {totals.lateMinutes}<span className="text-sm">分</span></p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${totals.earlyLeaveDays > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"}`}>
                    <p className="text-xs text-muted-foreground">早退</p>
                    <p className="text-lg font-bold">{totals.earlyLeaveDays}<span className="text-sm">回</span> / {totals.earlyLeaveMinutes}<span className="text-sm">分</span></p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">有給</p>
                    <p className="text-2xl font-bold">{totals.paidLeave}<span className="text-sm">日</span></p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">欠勤</p>
                    <p className="text-2xl font-bold">{totals.absent}<span className="text-sm">日</span></p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 日別明細テーブル */}
          <Card>
            <CardHeader>
              <CardTitle>日別明細</CardTitle>
              <CardDescription>
                {data.attendances.length > 0
                  ? `${data.attendances.length}件のデータ${isAllView ? "（全員）" : ""}`
                  : "データがありません"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.attendances.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">データがありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isAllView && (
                          <>
                            <TableHead className="whitespace-nowrap">社員</TableHead>
                            <TableHead className="whitespace-nowrap">社員番号</TableHead>
                          </>
                        )}
                        <TableHead className="whitespace-nowrap">日付</TableHead>
                        <TableHead>曜</TableHead>
                        <TableHead>区分</TableHead>
                        <TableHead>出勤</TableHead>
                        <TableHead>退勤</TableHead>
                        <TableHead>実働</TableHead>
                        <TableHead>運転</TableHead>
                        <TableHead>荷役</TableHead>
                        <TableHead>休憩</TableHead>
                        <TableHead>残業</TableHead>
                        <TableHead className="whitespace-nowrap">早朝</TableHead>
                        <TableHead>遅刻</TableHead>
                        <TableHead>早退</TableHead>
                        <TableHead className="whitespace-nowrap" title="Excel列S">平均下限</TableHead>
                        <TableHead className="whitespace-nowrap" title="Excel列T">判定</TableHead>
                        <TableHead>承認</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.attendances.map((a) => {
                        const isSunday = a.dayOfWeek === "日";
                        const isSaturday = a.dayOfWeek === "土";
                        const rowClass = isSunday
                          ? "bg-red-50 dark:bg-red-900/10"
                          : isSaturday
                            ? "bg-blue-50 dark:bg-blue-900/10"
                            : "";
                        return (
                          <TableRow key={a.id} className={rowClass}>
                            {isAllView && (
                              <>
                                <TableCell className="whitespace-nowrap font-medium">
                                  {a.user?.name || "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs">
                                  {a.user?.employeeId || "-"}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="whitespace-nowrap font-medium">
                              {formatDateShort(a.date)}
                            </TableCell>
                            <TableCell className={isSunday ? "text-red-600 font-bold" : isSaturday ? "text-blue-600 font-bold" : ""}>
                              {a.dayOfWeek || "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {CATEGORY_LABELS[a.category] || a.category}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{a.clockInRounded || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{a.clockOutRounded || "-"}</TableCell>
                            <TableCell>{a.actualHours > 0 ? a.actualHours : "-"}</TableCell>
                            <TableCell>{a.drivingHours > 0 ? a.drivingHours : "-"}</TableCell>
                            <TableCell>{a.loadingHours > 0 ? a.loadingHours : "-"}</TableCell>
                            <TableCell>{a.breakHours}</TableCell>
                            <TableCell className={a.overtimeHours > 0 ? "font-bold text-orange-600" : ""}>
                              {a.overtimeHours > 0 ? a.overtimeHours : "-"}
                            </TableCell>
                            <TableCell className={a.earlyOvertimeHours > 0 ? "font-bold text-blue-600" : ""}>
                              {a.earlyOvertimeHours > 0 ? a.earlyOvertimeHours : "-"}
                            </TableCell>
                            <TableCell className={a.lateMinutes > 0 ? "font-bold text-orange-600" : ""}>
                              {a.lateMinutes > 0 ? `${a.lateMinutes}分` : "-"}
                            </TableCell>
                            <TableCell className={a.earlyLeaveMinutes > 0 ? "font-bold text-orange-600" : ""}>
                              {a.earlyLeaveMinutes > 0 ? `${a.earlyLeaveMinutes}分` : "-"}
                            </TableCell>
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
                            <TableCell>
                              {a.approvalStatus === "APPROVED" ? (
                                <Badge>済</Badge>
                              ) : a.approvalStatus === "REJECTED" ? (
                                <Badge variant="destructive">戻</Badge>
                              ) : (
                                <Badge variant="outline">未</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* 合計行 */}
                      {totals && (
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell colSpan={isAllView ? 5 : 3}>合計</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell>{totals.actual.toFixed(1)}</TableCell>
                          <TableCell>{totals.driving.toFixed(1)}</TableCell>
                          <TableCell>{totals.loading.toFixed(1)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-orange-600">{totals.overtime.toFixed(1)}</TableCell>
                          <TableCell className="text-blue-600">{totals.earlyOvertime.toFixed(1)}</TableCell>
                          <TableCell className="text-orange-600">{totals.lateMinutes}分</TableCell>
                          <TableCell className="text-orange-600">{totals.earlyLeaveMinutes}分</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
