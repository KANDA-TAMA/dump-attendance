"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const CATEGORIES = [
  { value: "WORK1", label: "出勤① (6:30-15:30)" },
  { value: "WORK2", label: "出勤② (8:00-17:00)" },
  { value: "LEGAL_HOLIDAY", label: "法定休日出勤" },
  { value: "PRESCRIBED_HOLIDAY", label: "所定休日出勤" },
  { value: "PAID_LEAVE", label: "有給" },
  { value: "AM_LEAVE", label: "午前有給" },
  { value: "PM_LEAVE", label: "午後有給" },
  { value: "ABSENT", label: "欠勤" },
  { value: "HOLIDAY", label: "休日" },
  { value: "SPECIAL_LEAVE", label: "特休" },
];

const DRIVING_HOURS_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const val = i * 0.5;
  return { value: val.toString(), label: `${val} 時間` };
});

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 分は 30 分刻みのみ選択可能にする
const MINUTES = ["00", "30"];

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function TimeInput24({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  id: string;
  disabled?: boolean;
}) {
  const [h, m] = value ? value.split(":") : ["", ""];
  const hour = h || "";
  const minute = m || "";

  const handleChange = (newH: string, newM: string) => {
    if (disabled) return;
    // どちらか一方でも「--」が選ばれたら、時刻を完全にクリアする
    if (!newH || !newM) {
      onChange("");
      return;
    }
    onChange(`${newH}:${newM}`);
  };

  const selectClass =
    "flex h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const disabledClass = disabled ? "opacity-60 cursor-not-allowed" : "";

  return (
    <div className={`flex items-center gap-1 ${disabledClass}`}>
      <select
        id={id}
        className={`${selectClass} w-[70px]`}
        value={hour}
        onChange={(e) => handleChange(e.target.value, minute || "00")}
        disabled={disabled}
      >
        <option value="">--</option>
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>{hh}</option>
        ))}
      </select>
      <span className="text-lg font-bold">:</span>
      <select
        className={`${selectClass} w-[70px]`}
        value={minute}
        onChange={(e) => handleChange(hour || "00", e.target.value)}
        disabled={disabled}
      >
        <option value="">--</option>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>{mm}</option>
        ))}
      </select>
    </div>
  );
}

interface AttendanceData {
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
}

function getNowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function defaultCategory(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay() === 0 ? "HOLIDAY" : "WORK1";
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = DAY_NAMES[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${dow})`;
}

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [missingPeriod, setMissingPeriod] = useState<{ startDate: string; endDate: string } | null>(null);

  const isToday = selectedDate === toDateStr(new Date());

  const [form, setForm] = useState({
    category: defaultCategory(toDateStr(new Date())),
    clockInRaw: getNowHHMM(),
    clockOutRaw: "",
    drivingHours: "0",
    breakHours: "1",
    note: "",
  });

  const fetchAttendance = useCallback(async (date: string) => {
    setAttendance(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/attendance/today?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setAttendance(data);
          const isHoliday = data.category === "HOLIDAY";
          setForm({
            category: data.category || "WORK1",
            clockInRaw: isHoliday ? "" : (data.clockInRaw || (date === toDateStr(new Date()) ? getNowHHMM() : "")),
            clockOutRaw: isHoliday ? "" : (data.clockOutRaw || ""),
            drivingHours: isHoliday ? "0" : (data.drivingHours ?? 0).toString(),
            breakHours: (data.breakHours ?? 1).toString(),
            note: data.note || "",
          });
        } else {
          setForm({
            category: defaultCategory(date),
            clockInRaw: date === toDateStr(new Date()) ? getNowHHMM() : "",
            clockOutRaw: "",
            drivingHours: "0",
            breakHours: "1",
            note: "",
          });
        }
      }
    } catch {
      // no data
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate, fetchAttendance]);

  const fetchMissingDates = useCallback(async () => {
    try {
      const now = new Date();
      const res = await fetch(
        `/api/attendance/missing-dates?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      );
      if (res.ok) {
        const data = await res.json();
        setMissingDates(data.missingDates || []);
        setMissingPeriod(data.period ? { startDate: data.period.startDate, endDate: data.period.endDate } : null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMissingDates();
  }, [fetchMissingDates]);

  const handleClock = async (action: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchAttendance(selectedDate);
      }
    } catch (error) {
      console.error("Clock error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/attendance/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          category: form.category,
          clockInRaw: form.clockInRaw || null,
          clockOutRaw: form.clockOutRaw || null,
          drivingHours: parseFloat(form.drivingHours) || 0,
          breakHours: parseFloat(form.breakHours) || 1,
          note: form.note || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        await fetchAttendance(selectedDate);
        await fetchMissingDates();
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const approvalLabel = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "未承認",
      APPROVED: "承認済",
      REJECTED: "差戻し",
    };
    return map[status] || status;
  };

  const approvalVariant = (status: string) => {
    if (status === "APPROVED") return "default" as const;
    if (status === "REJECTED") return "destructive" as const;
    return "outline" as const;
  };

  const categoryLabel = (val: string) =>
    CATEGORIES.find((c) => c.value === val)?.label || val;

  // ロールチェック：運転手以外（管理者・運行管理者など）はこのページで出勤簿入力できない
  if (status === "loading") {
    return (
      <div className="py-8 text-center text-muted-foreground">
        認証情報を確認しています...
      </div>
    );
  }

  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "DRIVER") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">出勤簿入力</h1>
        <p className="text-sm text-muted-foreground">
          出勤簿の入力は運転手のみが対象です。管理者・運行管理者は「勤怠承認」「月次集計」画面からご確認ください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">出勤簿入力</h1>
        <p className="text-muted-foreground">日付を選んで勤怠を入力します</p>
      </div>

      {/* 勤怠入力漏れアラート：未入力日を表示 */}
      {missingDates.length > 0 && missingPeriod && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span>⚠️</span>
              勤怠入力漏れがあります
            </CardTitle>
            <CardDescription>
              {missingPeriod.startDate} 〜 {missingPeriod.endDate} の期間で、以下の日付が未入力です。クリックして入力してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {missingDates.map((d) => (
                <Button
                  key={d}
                  variant="outline"
                  size="sm"
                  className="text-amber-800 border-amber-400 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/50"
                  onClick={() => setSelectedDate(d)}
                >
                  {formatDateJP(d)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 日付選択 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            >
              ◀ 前日
            </Button>
            <div className="flex flex-col items-center gap-1">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto text-center"
              />
              <p className="text-sm font-semibold">
                {formatDateJP(selectedDate)}
                {isToday && (
                  <Badge variant="secondary" className="ml-2">今日</Badge>
                )}
                {attendance && (
                  <Badge variant={approvalVariant(attendance.approvalStatus)} className="ml-2">
                    {approvalLabel(attendance.approvalStatus)}
                  </Badge>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              翌日 ▶
            </Button>
          </div>
          {!isToday && (
            <div className="mt-2 text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => setSelectedDate(toDateStr(new Date()))}
              >
                今日に戻る
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 打刻ボタン（今日のみ） */}
      {isToday && (
        <Card>
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-4xl font-mono tabular-nums">
              {currentTime.toLocaleTimeString("ja-JP")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-16 text-lg"
                onClick={() => handleClock("clock-in")}
                disabled={loading || !!attendance?.clockInRaw}
              >
                🟢 出勤打刻
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-16 text-lg"
                onClick={() => handleClock("clock-out")}
                disabled={loading || !attendance?.clockInRaw || !!attendance?.clockOutRaw}
              >
                🔴 退勤打刻
              </Button>
            </div>
            {attendance && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                打刻済: 出勤 {attendance.clockInRaw || "--:--"} / 退勤 {attendance.clockOutRaw || "--:--"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* 勤怠詳細入力フォーム */}
      <Card>
        <CardHeader>
          <CardTitle>勤怠詳細入力</CardTitle>
          <CardDescription>
            {formatDateJP(selectedDate)} の勤怠データ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 区分 */}
          <div className="space-y-2">
            <Label htmlFor="category">区分</Label>
            <select
              id="category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.category}
              onChange={(e) => {
                const newCategory = e.target.value;
                if (newCategory === "HOLIDAY") {
                  setForm({
                    ...form,
                    category: newCategory,
                    clockInRaw: "",
                    clockOutRaw: "",
                    drivingHours: "0",
                  });
                } else {
                  setForm({ ...form, category: newCategory });
                }
                setSaved(false);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* 出勤・退勤時刻 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clockIn">出勤時刻</Label>
              <TimeInput24
                id="clockIn"
                value={form.clockInRaw}
                onChange={(val) => {
                  setForm({ ...form, clockInRaw: val });
                  setSaved(false);
                }}
                disabled={form.category === "HOLIDAY"}
              />
              {attendance?.clockInRounded && (
                <p className="text-xs text-muted-foreground">
                  給与計算用: {attendance.clockInRounded}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="clockOut">退勤時刻</Label>
              <TimeInput24
                id="clockOut"
                value={form.clockOutRaw}
                onChange={(val) => {
                  setForm({ ...form, clockOutRaw: val });
                  setSaved(false);
                }}
                disabled={form.category === "HOLIDAY"}
              />
              {attendance?.clockOutRounded && (
                <p className="text-xs text-muted-foreground">
                  給与計算用: {attendance.clockOutRounded}
                </p>
              )}
            </div>
          </div>

          {/* 運転時間・休憩時間 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="drivingHours">運転時間</Label>
              <select
                id="drivingHours"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
                value={form.category === "HOLIDAY" ? "0" : form.drivingHours}
                onChange={(e) => {
                  if (form.category === "HOLIDAY") return;
                  setForm({ ...form, drivingHours: e.target.value });
                  setSaved(false);
                }}
                disabled={form.category === "HOLIDAY"}
              >
                {DRIVING_HOURS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="breakHours">休憩時間 (時間)</Label>
              <Input
                id="breakHours"
                type="number"
                step="0.5"
                min="0"
                value={form.breakHours}
                onChange={(e) => {
                  setForm({ ...form, breakHours: e.target.value });
                  setSaved(false);
                }}
              />
              <p className="text-xs text-muted-foreground">デフォルト: 1時間</p>
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-2">
            <Label htmlFor="note">備考</Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={(e) => {
                setForm({ ...form, note: e.target.value });
                setSaved(false);
              }}
              placeholder="特記事項があれば記入"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">保存しました</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 自動計算結果 */}
      {attendance && (
        <Card>
          <CardHeader>
            <CardTitle>計算結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">区分</p>
                <p className="text-sm font-bold">
                  {categoryLabel(attendance.category)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">実働時間</p>
                <p className="text-xl font-bold">{attendance.actualHours}h</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">運転時間</p>
                <p className="text-xl font-bold">{attendance.drivingHours}h</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">荷役時間</p>
                <p className="text-xl font-bold">{attendance.loadingHours}h</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">休憩時間</p>
                <p className="text-xl font-bold">{attendance.breakHours}h</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">残業時間</p>
                <p className="text-xl font-bold">{attendance.overtimeHours}h</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${attendance.earlyOvertimeHours > 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"}`}>
                <p className="text-xs text-muted-foreground">早朝残業</p>
                <p className="text-xl font-bold">{attendance.earlyOvertimeHours}h</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${attendance.lateMinutes > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"}`}>
                <p className="text-xs text-muted-foreground">遅刻</p>
                <p className="text-xl font-bold">
                  {attendance.lateMinutes > 0 ? `${attendance.lateMinutes}分` : "なし"}
                </p>
              </div>
              <div className={`rounded-lg p-3 text-center ${attendance.earlyLeaveMinutes > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"}`}>
                <p className="text-xs text-muted-foreground">早退</p>
                <p className="text-xl font-bold">
                  {attendance.earlyLeaveMinutes > 0 ? `${attendance.earlyLeaveMinutes}分` : "なし"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">出勤(丸め)</p>
                <p className="text-lg font-bold">
                  {attendance.clockInRounded || "--:--"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">退勤(丸め)</p>
                <p className="text-lg font-bold">
                  {attendance.clockOutRounded || "--:--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
