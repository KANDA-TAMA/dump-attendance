"use client";

import { useState, useEffect, useCallback } from "react";
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

interface User {
  id: string;
  employeeId: string;
  name: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  dayOfWeek: string | null;
  category: string;
  clockInRaw: string | null;
  clockOutRaw: string | null;
  clockInRounded: string | null;
  clockOutRounded: string | null;
  actualHours: number;
  drivingHours: number;
  loadingHours: number;
  breakHours: number;
  overtimeHours: number;
  earlyOvertimeHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  approvalStatus: string;
  note: string | null;
  user: { name: string; employeeId: string };
  approver: { name: string } | null;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface TodayDriverAttendance {
  id: string;
  clockInRaw: string | null;
  clockOutRaw: string | null;
  clockInRounded: string | null;
  clockOutRounded: string | null;
  actualHours: number;
  drivingHours: number;
  loadingHours: number;
  breakHours: number;
  overtimeHours: number;
  earlyOvertimeHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  approvalStatus: string;
  category: string;
}

interface TodayDriverRow {
  userId: string;
  name: string;
  employeeId: string;
  attendance: TodayDriverAttendance | null;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "number" && v === 0) return "0";
  return String(v);
}

export default function ApprovalPage() {
  const now = new Date();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [status, setStatus] = useState("PENDING");
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [approveTodayLoading, setApproveTodayLoading] = useState(false);
  const [approveTodayMessage, setApproveTodayMessage] = useState<string | null>(null);
  const [todayDriversDate, setTodayDriversDate] = useState<string | null>(null);
  const [todayDriverRows, setTodayDriverRows] = useState<TodayDriverRow[]>([]);

  const fetchTodayDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/today-drivers");
      if (!res.ok) return;
      const data = await res.json();
      setTodayDriversDate(data.date);
      setTodayDriverRows(data.rows || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTodayDrivers();
  }, [fetchTodayDrivers]);

  useEffect(() => {
    fetch("/api/users?role=DRIVER")
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch(console.error);
  }, []);

  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.set("userId", selectedUserId);
      params.set("status", status);
      params.set("year", year.toString());
      params.set("month", month.toString());

      const res = await fetch(`/api/attendance/pending?${params}`);
      if (res.ok) {
        setAttendances(await res.json());
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, status, year, month]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  const handleApproval = async (attendanceId: string, action: "approve" | "reject") => {
    setProcessing(attendanceId);
    try {
      const res = await fetch("/api/attendance/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, action }),
      });
      if (res.ok) {
        await fetchAttendances();
      }
    } catch (error) {
      console.error("Approval error:", error);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    const pending = attendances.filter((a) => a.approvalStatus === "PENDING");
    if (pending.length === 0) return;
    if (!confirm(`${pending.length}件を一括承認します。よろしいですか？`)) return;

    setProcessing("bulk");
    try {
      for (const a of pending) {
        await fetch("/api/attendance/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceId: a.id, action: "approve" }),
        });
      }
      await fetchAttendances();
    } catch (error) {
      console.error("Bulk approval error:", error);
    } finally {
      setProcessing(null);
    }
  };

  /** 運転手全員の当日分・未承認を一括承認 */
  const handleApproveTodayDrivers = async () => {
    if (
      !confirm(
        "運転手全員の「当日分」で未承認の勤怠をすべて承認します。よろしいですか？"
      )
    )
      return;
    setApproveTodayLoading(true);
    setApproveTodayMessage(null);
    try {
      const res = await fetch("/api/attendance/approve-today-drivers", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setApproveTodayMessage(
          data.approvedCount > 0
            ? `${data.date} の運転手 ${data.approvedCount}件を承認しました`
            : data.message || "対象がありませんでした"
        );
        await fetchTodayDrivers();
        await fetchAttendances();
      } else {
        setApproveTodayMessage(data.error || "失敗しました");
      }
    } catch {
      setApproveTodayMessage("通信エラーが発生しました");
    } finally {
      setApproveTodayLoading(false);
    }
  };

  const pendingCount = attendances.filter((a) => a.approvalStatus === "PENDING").length;
  const approvedCount = attendances.filter((a) => a.approvalStatus === "APPROVED").length;
  const rejectedCount = attendances.filter((a) => a.approvalStatus === "REJECTED").length;

  const startMonth = month === 1 ? 12 : month - 1;
  const startYear = month === 1 ? year - 1 : year;
  const periodLabel = `${startYear}/${startMonth}/11 〜 ${year}/${month}/10`;

  const selectClass =
    "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">勤怠承認</h1>
        <p className="text-muted-foreground">社員の勤怠データを確認・承認します</p>
      </div>

      {/* フィルタ */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">運転手</label>
              <select
                className={`${selectClass} min-w-[200px]`}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">運転手全員（期間内）</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">年</label>
              <select
                className={selectClass}
                value={year.toString()}
                onChange={(e) => setYear(parseInt(e.target.value))}
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y.toString()}>{y}年</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">締め月</label>
              <select
                className={selectClass}
                value={month.toString()}
                onChange={(e) => setMonth(parseInt(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m.toString()}>{m}月</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ステータス</label>
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="PENDING">未承認</option>
                <option value="APPROVED">承認済</option>
                <option value="REJECTED">差戻し</option>
                <option value="ALL">すべて</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 当日分 運転手一括承認 */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">当日分・運転手一括承認</CardTitle>
          <CardDescription>
            運転手権限の社員のうち、本日の日付で未承認の勤怠をまとめて承認します（管理者・運行管理者向け）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleApproveTodayDrivers}
              disabled={approveTodayLoading}
            >
              {approveTodayLoading ? "処理中..." : "当日分を運転手全員分まとめて承認"}
            </Button>
            {approveTodayMessage && (
              <span className="text-sm text-muted-foreground">{approveTodayMessage}</span>
            )}
            {todayDriversDate && (
              <span className="text-xs text-muted-foreground">
                表示日付: {todayDriversDate}
              </span>
            )}
          </div>

          {/* 運転手毎 当日分サマリー */}
          {todayDriverRows.length > 0 && (
            <div className="overflow-x-auto rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">運転手</TableHead>
                    <TableHead className="whitespace-nowrap">社員番号</TableHead>
                    <TableHead className="whitespace-nowrap">出勤(生)</TableHead>
                    <TableHead className="whitespace-nowrap">退勤(生)</TableHead>
                    <TableHead className="whitespace-nowrap">出勤(丸め)</TableHead>
                    <TableHead className="whitespace-nowrap">退勤(丸め)</TableHead>
                    <TableHead>実働</TableHead>
                    <TableHead>運転</TableHead>
                    <TableHead>荷役</TableHead>
                    <TableHead>休憩</TableHead>
                    <TableHead>残業</TableHead>
                    <TableHead>早朝</TableHead>
                    <TableHead>遅刻(分)</TableHead>
                    <TableHead>早退(分)</TableHead>
                    <TableHead className="whitespace-nowrap">承認</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayDriverRows.map((row) => {
                    const a = row.attendance;
                    return (
                      <TableRow key={row.userId}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {row.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {row.employeeId}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {a ? cell(a.clockInRaw) : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {a ? cell(a.clockOutRaw) : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {a ? cell(a.clockInRounded) : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {a ? cell(a.clockOutRounded) : "-"}
                        </TableCell>
                        <TableCell>{a ? a.actualHours : "-"}</TableCell>
                        <TableCell>{a ? a.drivingHours : "-"}</TableCell>
                        <TableCell>{a ? a.loadingHours : "-"}</TableCell>
                        <TableCell>{a ? a.breakHours : "-"}</TableCell>
                        <TableCell className={a && a.overtimeHours > 0 ? "font-bold text-orange-600" : ""}>
                          {a ? a.overtimeHours : "-"}
                        </TableCell>
                        <TableCell className={a && a.earlyOvertimeHours > 0 ? "font-bold text-blue-600" : ""}>
                          {a ? a.earlyOvertimeHours : "-"}
                        </TableCell>
                        <TableCell className={a && a.lateMinutes > 0 ? "font-bold text-orange-600" : ""}>
                          {a ? (a.lateMinutes > 0 ? `${a.lateMinutes}` : "0") : "-"}
                        </TableCell>
                        <TableCell className={a && a.earlyLeaveMinutes > 0 ? "font-bold text-orange-600" : ""}>
                          {a ? (a.earlyLeaveMinutes > 0 ? `${a.earlyLeaveMinutes}` : "0") : "-"}
                        </TableCell>
                        <TableCell>
                          {!a ? (
                            <Badge variant="outline">未入力</Badge>
                          ) : a.approvalStatus === "APPROVED" ? (
                            <Badge>承認済</Badge>
                          ) : a.approvalStatus === "REJECTED" ? (
                            <Badge variant="destructive">差戻</Badge>
                          ) : (
                            <Badge variant="outline">未承認</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">対象期間</p>
            <p className="text-sm font-bold">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">未承認</p>
            <p className="text-2xl font-bold text-orange-600">{pendingCount}<span className="text-sm">件</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">承認済</p>
            <p className="text-2xl font-bold text-green-600">{approvedCount}<span className="text-sm">件</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">差戻し</p>
            <p className="text-2xl font-bold text-red-600">{rejectedCount}<span className="text-sm">件</span></p>
          </CardContent>
        </Card>
      </div>

      {/* 一括承認ボタン */}
      {pendingCount > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleBulkApprove}
            disabled={processing === "bulk"}
          >
            {processing === "bulk" ? "処理中..." : `未承認 ${pendingCount}件を一括承認`}
          </Button>
        </div>
      )}

      {loading && <p className="text-center text-muted-foreground">読み込み中...</p>}

      {/* 勤怠一覧テーブル */}
      <Card>
        <CardHeader>
          <CardTitle>
            勤怠一覧
            <Badge variant="outline" className="ml-2">{attendances.length}件</Badge>
          </CardTitle>
          <CardDescription>
            {selectedUserId
              ? `${users.find((u) => u.id === selectedUserId)?.name || ""} の勤怠データ`
              : "全社員の勤怠データ"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              該当するデータがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">社員</TableHead>
                    <TableHead className="whitespace-nowrap">日付</TableHead>
                    <TableHead>曜</TableHead>
                    <TableHead>区分</TableHead>
                    <TableHead>出勤</TableHead>
                    <TableHead>退勤</TableHead>
                    <TableHead>実働</TableHead>
                    <TableHead>運転</TableHead>
                    <TableHead>残業</TableHead>
                    <TableHead>早朝</TableHead>
                    <TableHead>遅刻</TableHead>
                    <TableHead>早退</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((a) => {
                    const isSunday = a.dayOfWeek === "日";
                    const isSaturday = a.dayOfWeek === "土";
                    const rowClass = isSunday
                      ? "bg-red-50 dark:bg-red-900/10"
                      : isSaturday
                        ? "bg-blue-50 dark:bg-blue-900/10"
                        : "";
                    return (
                      <TableRow key={a.id} className={rowClass}>
                        <TableCell className="whitespace-nowrap">
                          <p className="font-medium text-sm">{a.user.name}</p>
                          <p className="text-xs text-muted-foreground">{a.user.employeeId}</p>
                        </TableCell>
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
                        <TableCell>
                          {a.approvalStatus === "APPROVED" ? (
                            <Badge>承認済</Badge>
                          ) : a.approvalStatus === "REJECTED" ? (
                            <Badge variant="destructive">差戻し</Badge>
                          ) : (
                            <Badge variant="outline">未承認</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.approvalStatus === "PENDING" ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleApproval(a.id, "approve")}
                                disabled={processing !== null}
                              >
                                承認
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApproval(a.id, "reject")}
                                disabled={processing !== null}
                              >
                                差戻
                              </Button>
                            </div>
                          ) : a.approvalStatus === "APPROVED" ? (
                            <span className="text-xs text-muted-foreground">
                              {a.approver?.name || "-"}
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproval(a.id, "approve")}
                              disabled={processing !== null}
                            >
                              再承認
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
