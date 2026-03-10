"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RecalcDrivingAvgButton({ label = "平均下限・判定を再計算" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const run = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/attendance/recalc-driving-avg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`${data.updated}件を更新しました`);
        router.refresh();
      } else {
        setMsg(data.error || "失敗しました");
      }
    } catch {
      setMsg("通信エラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
        {loading ? "計算中…" : label}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
