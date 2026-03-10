"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: "number" | "text" | "password";
}

const SETTING_DEFS: SettingItem[] = [
  { key: "CLOSING_DAY", label: "締め日", description: "月次集計の締め日（例: 10 → 毎月10日締め）", type: "number" },
  { key: "DEFAULT_BREAK_HOURS", label: "デフォルト休憩時間", description: "勤怠入力時のデフォルト休憩時間（時間単位）", type: "number" },
  { key: "DEFAULT_CATEGORY", label: "デフォルト区分", description: "平日のデフォルト勤務区分（WORK1 or WORK2）", type: "text" },
  { key: "WORK1_START", label: "出勤①開始時刻", description: "出勤①の所定開始時刻（HH:mm）", type: "text" },
  { key: "WORK1_END", label: "出勤①終了時刻", description: "出勤①の所定終了時刻（HH:mm）", type: "text" },
  { key: "WORK2_START", label: "出勤②開始時刻", description: "出勤②の所定開始時刻（HH:mm）", type: "text" },
  { key: "WORK2_END", label: "出勤②終了時刻", description: "出勤②の所定終了時刻（HH:mm）", type: "text" },
  { key: "COMPANY_NAME", label: "会社名", description: "CSV出力等に使用する会社名", type: "text" },
];

const SMTP_SETTING_DEFS: SettingItem[] = [
  { key: "SMTP_HOST", label: "SMTPホスト", description: "メールサーバーのホスト名（例: smtp.gmail.com）", type: "text" },
  { key: "SMTP_PORT", label: "SMTPポート", description: "メールサーバーのポート（通常 587）", type: "number" },
  { key: "SMTP_USER", label: "SMTPユーザー", description: "メール送信に使用するメールアドレス", type: "text" },
  { key: "SMTP_PASS", label: "SMTPパスワード", description: "App Password 等（Gmailは2段階認証＋App Passwordが必要）", type: "password" },
];

const PASSWORD_PLACEHOLDER = "••••••••";

const DEFAULTS: Record<string, string> = {
  CLOSING_DAY: "10",
  DEFAULT_BREAK_HOURS: "1.0",
  DEFAULT_CATEGORY: "WORK1",
  WORK1_START: "06:30",
  WORK1_END: "15:30",
  WORK2_START: "08:00",
  WORK2_END: "17:00",
  COMPANY_NAME: "",
  SMTP_HOST: "",
  SMTP_PORT: "587",
  SMTP_USER: "",
  SMTP_PASS: "",
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const merged = { ...DEFAULTS, ...data };
        if (merged.SMTP_PASS) {
          merged.SMTP_PASS = PASSWORD_PLACEHOLDER;
        }
        setSettings(merged);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const toSave = { ...settings };
      if (toSave.SMTP_PASS === PASSWORD_PLACEHOLDER) {
        delete toSave.SMTP_PASS;
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      if (res.ok) setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">システム設定</h1>
        <p className="text-muted-foreground">勤怠システムの基本設定を管理します</p>
      </div>

      {isAdmin && (<Card>
        <CardHeader>
          <CardTitle>基本設定</CardTitle>
          <CardDescription>
            変更後は「保存」ボタンを押してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SETTING_DEFS.map((def) => (
            <div key={def.key} className="grid gap-2 sm:grid-cols-3 sm:items-center">
              <div>
                <Label htmlFor={def.key} className="font-medium">{def.label}</Label>
                <p className="text-xs text-muted-foreground">{def.description}</p>
              </div>
              <div className="sm:col-span-2">
                <Input
                  id={def.key}
                  type={def.type === "password" ? "password" : def.type}
                  value={settings[def.key] || ""}
                  onChange={(e) => {
                    setSettings({ ...settings, [def.key]: e.target.value });
                    setSaved(false);
                  }}
                  placeholder={def.type === "password" ? "変更する場合のみ入力" : undefined}
                  className="max-w-xs"
                />
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
            {saved && <span className="text-sm text-green-600">設定を保存しました</span>}
          </div>
        </CardContent>
      </Card>)}

      {isAdmin && (<Card>
        <CardHeader>
          <CardTitle>メール（SMTP）設定</CardTitle>
          <CardDescription>
            メール通知送信に使用するSMTPサーバーの設定。勤怠入力完了・承認完了時の通知に必要です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SMTP_SETTING_DEFS.map((def) => (
            <div key={def.key} className="grid gap-2 sm:grid-cols-3 sm:items-center">
              <div>
                <Label htmlFor={def.key} className="font-medium">{def.label}</Label>
                <p className="text-xs text-muted-foreground">{def.description}</p>
              </div>
              <div className="sm:col-span-2">
                <Input
                  id={def.key}
                  type={def.type === "password" ? "password" : def.type}
                  value={settings[def.key] || ""}
                  onChange={(e) => {
                    setSettings({ ...settings, [def.key]: e.target.value });
                    setSaved(false);
                  }}
                  placeholder={def.type === "password" ? "変更する場合のみ入力" : undefined}
                  className="max-w-xs"
                  autoComplete={def.type === "password" ? "new-password" : undefined}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
            {saved && <span className="text-sm text-green-600">設定を保存しました</span>}
          </div>
        </CardContent>
      </Card>)}

      {isAdmin && (<Card>
        <CardHeader>
          <CardTitle>設定の説明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>締め日:</strong> 月次集計の区切り日。10の場合、前月11日〜当月10日が1ヶ月の集計期間になります。未設定の締め月はこのルールで自動計算されます。</p>
          <p><strong>締め月ごとの対象期間:</strong> 特定の締め月だけ期間を変えたい場合は、下の「締め月ごとの対象期間」で登録してください。Excel出力・月次集計の日付表示が正しく反映されます。</p>
          <p><strong>デフォルト休憩時間:</strong> 勤怠入力時に自動設定される休憩時間。通常1時間。</p>
          <p><strong>デフォルト区分:</strong> 平日の勤怠入力時に自動設定される区分。WORK1（出勤①）またはWORK2（出勤②）。</p>
          <p><strong>出勤①/②の時刻:</strong> 所定労働時間の開始・終了時刻。早朝残業・遅刻・早退の計算に使用されます。</p>
          <p><strong>SMTP設定:</strong> Gmailの場合は smtp.gmail.com / 587 / メールアドレス / App Password（2段階認証を有効化後に取得）。</p>
        </CardContent>
      </Card>)}

      {isAdmin && <PeriodSettings />}

      <ManagerNotificationSettings />
    </div>
  );
}

interface PeriodSettingItem {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

function PeriodSettings() {
  const [list, setList] = useState<PeriodSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchList = () => {
    fetch("/api/period-settings")
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      setError("開始日・終了日を入力してください");
      return;
    }
    if (startDate > endDate) {
      setError("開始日は終了日以前にしてください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/period-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, startDate, endDate }),
      });
      const data = await res.json();
      if (res.ok) {
        setList((prev) => {
          const filtered = prev.filter((p) => !(p.year === year && p.month === month));
          return [...filtered, data].sort((a, b) => a.year - b.year || a.month - b.month);
        });
        setStartDate("");
        setEndDate("");
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch (e) {
      console.error(e);
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (y: number, m: number) => {
    if (!confirm(`${y}年${m}月の対象期間設定を削除しますか？削除後は締め日から自動計算されます。`)) return;
    try {
      const res = await fetch(`/api/period-settings?year=${y}&month=${m}`, { method: "DELETE" });
      if (res.ok) {
        setList((prev) => prev.filter((p) => !(p.year === y && p.month === m)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>締め月ごとの対象期間</CardTitle>
        <CardDescription>
          特定の締め月だけ対象期間を変更したい場合に登録します。未登録の締め月は「締め日」設定から自動計算されます。Excel出力・月次集計の日付表示に反映されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-medium">新規登録・上書き</h4>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">年</Label>
              <Input
                type="number"
                min={2020}
                max={2030}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                className="w-24"
              />
            </div>
            <div>
              <Label className="text-xs">月（締め月）</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10) || month)}
                className="w-20"
              />
            </div>
            <div>
              <Label className="text-xs">開始日 (YYYY-MM-DD)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label className="text-xs">終了日 (YYYY-MM-DD)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "登録"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {list.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">登録済み</h4>
            <ul className="space-y-2">
              {list.map((p) => (
                <li
                  key={`${p.year}-${p.month}`}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span>
                    {p.year}年{p.month}月締め: {p.startDate} 〜 {p.endDate}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(p.year, p.month)}>
                    削除
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ManagerSetting {
  id: string;
  userId: string;
  email: string;
  priority: number;
  user: { name: string; employeeId: string };
}

function ManagerNotificationSettings() {
  const [managers, setManagers] = useState<{ id: string; name: string; employeeId: string; email?: string | null }[]>([]);
  const [settings, setSettings] = useState<ManagerSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [email, setEmail] = useState("");
  const [priority, setPriority] = useState(1);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.ok ? r.json() : []),
      fetch("/api/manager-notification-settings").then((r) => r.ok ? r.json() : []),
    ])
      .then(([users, mgrSettings]) => {
        const userList = Array.isArray(users) ? users : [];
        setManagers(userList.filter((u: { role: string }) => u.role === "MANAGER" || u.role === "ADMIN"));
        setSettings(Array.isArray(mgrSettings) ? mgrSettings : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleManagerSelect = (userId: string) => {
    setSelectedUserId(userId);
    const m = managers.find((x) => x.id === userId);
    setEmail(m?.email?.trim() || "");
  };

  const handleAdd = async () => {
    if (!selectedUserId || !email.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/manager-notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, email: email.trim(), priority }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => {
          const filtered = prev.filter((s) => s.userId !== data.userId);
          return [...filtered, data].sort((a, b) => a.priority - b.priority);
        });
        setSelectedUserId("");
        setEmail("");
        setPriority(1);
      } else {
        setAddError(data.error || "保存に失敗しました");
      }
    } catch (e) {
      console.error(e);
      setAddError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("この通知設定を削除しますか？")) return;
    try {
      const res = await fetch(`/api/manager-notification-settings?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) setSettings((prev) => prev.filter((s) => s.userId !== userId));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>運行管理者メール通知設定</CardTitle>
        <CardDescription>
          日次：運転手の勤怠保存がその日の全運転手分完了したタイミングで、優先順位が最も高い運行管理者にメール通知。期間完了時：対象期間の勤怠をすべて承認したタイミングで、優先順位で指定された運行管理者および管理者全員にメール通知。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-medium">日次通知・優先順位設定（新規追加）</h4>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">運行管理者</Label>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-48"
                value={selectedUserId}
                onChange={(e) => handleManagerSelect(e.target.value)}
              >
                <option value="">選択</option>
                {managers
                  .filter((m) => !settings.some((s) => s.userId === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.employeeId})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">メールアドレス *</Label>
              <Input
                type="text"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例: manager@example.com"
                className="w-56"
              />
            </div>
            <div>
              <Label className="text-xs">優先順位（1=最優先）</Label>
              <Input
                type="number"
                min={1}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                className="w-20"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={saving || !selectedUserId || !email.trim()}
              title={!selectedUserId ? "運行管理者を選択してください" : !email.trim() ? "メールアドレスを入力してください" : undefined}
            >
              追加
            </Button>
          </div>
          {addError && (
            <p className="text-sm text-destructive">{addError}</p>
          )}
        </div>

        {settings.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">登録済み</h4>
            <ul className="space-y-2">
              {settings.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span>
                    {s.user?.name} ({s.user?.employeeId}) — {s.email} — 優先{s.priority}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(s.userId)}>
                    削除
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          メール送信には上記「メール（SMTP）設定」の入力が必要です。管理者への通知には User の email が設定されている必要があります。
        </p>
      </CardContent>
    </Card>
  );
}
