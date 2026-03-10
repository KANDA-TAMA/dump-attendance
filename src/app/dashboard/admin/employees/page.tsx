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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理者",
  MANAGER: "運行管理者",
  DRIVER: "運転手",
};

interface User {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  phone: string | null;
  isActive: boolean;
}

const emptyForm = {
  employeeId: "",
  name: "",
  role: "DRIVER",
  phone: "",
  password: "",
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function EmployeesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?all=${showInactive}`);
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
    setSuccess("");
  };

  const startEdit = (user: User) => {
    setForm({
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      phone: user.phone || "",
      password: "",
    });
    setEditingId(user.id);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        const res = await fetch(`/api/users/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "更新に失敗しました");
          return;
        }
        setSuccess("社員情報を更新しました");
      } else {
        if (!form.password) {
          setError("新規登録時はパスワードが必須です");
          return;
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "登録に失敗しました");
          return;
        }
        setSuccess("社員を登録しました");
      }
      await fetchUsers();
      resetForm();
    } catch {
      setError("処理に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    const action = user.isActive ? "無効化" : "有効化";
    if (!confirm(`${user.name} を${action}しますか？`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) await fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">社員管理</h1>
          <p className="text-muted-foreground">社員の登録・編集を行います</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? "有効のみ表示" : "無効含む表示"}
          </Button>
          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            + 新規登録
          </Button>
        </div>
      </div>

      {/* 登録・編集フォーム */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "社員編集" : "社員新規登録"}</CardTitle>
            <CardDescription>
              {editingId ? "変更する項目を入力してください" : "新しい社員を登録します"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">社員番号 *</Label>
                  <Input
                    id="employeeId"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="例: DRV003"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">氏名 *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例: 田中 三郎"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">権限</Label>
                  <select
                    id="role"
                    className={selectClass}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="DRIVER">運転手</option>
                    <option value="MANAGER">運行管理者</option>
                    <option value="ADMIN">管理者</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="例: 090-1234-5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    パスワード {editingId ? "(変更する場合のみ)" : "*"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingId ? "変更しない場合は空欄" : "パスワードを入力"}
                    required={!editingId}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "処理中..." : editingId ? "更新" : "登録"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  キャンセル
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 社員一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>
            社員一覧
            <Badge variant="outline" className="ml-2">{users.length}名</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">読み込み中...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">社員が登録されていません</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>社員番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>権限</TableHead>
                    <TableHead>電話番号</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                      <TableCell className="font-mono">{u.employeeId}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "ADMIN" ? "default" : u.role === "MANAGER" ? "secondary" : "outline"}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.phone || "-"}</TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="default">有効</Badge>
                        ) : (
                          <Badge variant="destructive">無効</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                            編集
                          </Button>
                          <Button
                            size="sm"
                            variant={u.isActive ? "destructive" : "default"}
                            onClick={() => toggleActive(u)}
                          >
                            {u.isActive ? "無効化" : "有効化"}
                          </Button>
                        </div>
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
