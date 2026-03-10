"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

interface Holiday {
  id: string;
  date: string;
  name: string;
  holidayType: string;
}

const NATIONAL_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "元日" },
  { date: "2026-01-12", name: "成人の日" },
  { date: "2026-02-11", name: "建国記念の日" },
  { date: "2026-02-23", name: "天皇誕生日" },
  { date: "2026-03-20", name: "春分の日" },
  { date: "2026-04-29", name: "昭和の日" },
  { date: "2026-05-03", name: "憲法記念日" },
  { date: "2026-05-04", name: "みどりの日" },
  { date: "2026-05-05", name: "こどもの日" },
  { date: "2026-05-06", name: "振替休日" },
  { date: "2026-07-20", name: "海の日" },
  { date: "2026-08-11", name: "山の日" },
  { date: "2026-09-21", name: "敬老の日" },
  { date: "2026-09-22", name: "国民の休日" },
  { date: "2026-09-23", name: "秋分の日" },
  { date: "2026-10-12", name: "スポーツの日" },
  { date: "2026-11-03", name: "文化の日" },
  { date: "2026-11-23", name: "勤労感謝の日" },
];

function getDow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES[d.getDay()];
}

const selectClass =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function HolidaysPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", name: "", holidayType: "LEGAL" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/holidays?year=${year}`);
      if (res.ok) setHolidays(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.name) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "登録に失敗しました");
        return;
      }
      setForm({ date: "", name: "", holidayType: "LEGAL" });
      setShowForm(false);
      await fetchHolidays();
    } catch {
      setError("登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try {
      const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
      if (res.ok) await fetchHolidays();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkImport = async () => {
    const existing = holidays.map((h) => h.date);
    const toImport = NATIONAL_HOLIDAYS_2026.filter((h) => !existing.includes(h.date));
    if (toImport.length === 0) {
      alert("全ての祝日は既に登録されています");
      return;
    }
    if (!confirm(`${year}年の祝日 ${toImport.length}件を一括登録しますか？`)) return;

    setSaving(true);
    try {
      for (const h of toImport) {
        await fetch("/api/holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: h.date, name: h.name, holidayType: "LEGAL" }),
        });
      }
      await fetchHolidays();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">休日設定</h1>
          <p className="text-muted-foreground">祝日・会社休日を管理します</p>
        </div>
        <div className="flex gap-2">
          {year === 2026 && (
            <Button variant="outline" onClick={handleBulkImport} disabled={saving}>
              📅 2026年祝日一括登録
            </Button>
          )}
          <Button onClick={() => setShowForm(!showForm)}>
            + 休日追加
          </Button>
        </div>
      </div>

      {/* 年選択 */}
      <Card>
        <CardContent className="flex items-end gap-4 pt-4">
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
          <p className="text-sm text-muted-foreground pb-2">
            登録済: {holidays.length}件
          </p>
        </CardContent>
      </Card>

      {/* 追加フォーム */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>休日追加</CardTitle>
            <CardDescription>祝日や会社休日を登録します</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="hDate">日付</Label>
                <Input
                  id="hDate"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hName">名称</Label>
                <Input
                  id="hName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: 元日"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hType">種別</Label>
                <select
                  id="hType"
                  className={selectClass}
                  value={form.holidayType}
                  onChange={(e) => setForm({ ...form, holidayType: e.target.value })}
                >
                  <option value="LEGAL">法定休日</option>
                  <option value="PRESCRIBED">所定休日</option>
                  <option value="COMPANY">会社休日</option>
                </select>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "登録中..." : "登録"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                キャンセル
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* 休日一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>{year}年 休日一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">読み込み中...</p>
          ) : holidays.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              休日が登録されていません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>曜日</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono">{h.date}</TableCell>
                      <TableCell className={getDow(h.date) === "日" ? "text-red-600 font-bold" : getDow(h.date) === "土" ? "text-blue-600 font-bold" : ""}>
                        {getDow(h.date)}
                      </TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>
                        <Badge variant={h.holidayType === "LEGAL" ? "default" : h.holidayType === "PRESCRIBED" ? "secondary" : "outline"}>
                          {h.holidayType === "LEGAL" ? "法定休日" : h.holidayType === "PRESCRIBED" ? "所定休日" : "会社休日"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(h.id, h.name)}
                        >
                          削除
                        </Button>
                      </TableCell>
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
