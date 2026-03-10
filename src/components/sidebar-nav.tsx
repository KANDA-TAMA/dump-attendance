"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { title: "ダッシュボード", href: "/dashboard", icon: "📊" },
  { title: "出勤簿入力", href: "/dashboard/attendance", icon: "⏰" },
  { title: "勤怠一覧", href: "/dashboard/history", icon: "📅" },
  { title: "月次集計", href: "/dashboard/monthly", icon: "📈" },
  {
    title: "勤怠承認",
    href: "/dashboard/admin/approval",
    icon: "✅",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    title: "社員管理",
    href: "/dashboard/admin/employees",
    icon: "👥",
    roles: ["ADMIN"],
  },
  {
    title: "休日設定",
    href: "/dashboard/admin/holidays",
    icon: "📆",
    roles: ["ADMIN"],
  },
  {
    title: "システム設定",
    href: "/dashboard/admin/settings",
    icon: "⚙️",
    roles: ["ADMIN", "MANAGER"],
  },
];

interface SidebarNavProps {
  userRole: string;
  userName: string;
}

export function SidebarNav({ userRole, userName }: SidebarNavProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-bold">🚛 勤怠管理</h2>
        <p className="text-sm text-muted-foreground">{userName}</p>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          🚪 ログアウト
        </Button>
      </div>
    </div>
  );
}
