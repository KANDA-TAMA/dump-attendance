import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/session-provider";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <SessionProvider>
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r bg-card md:block">
          <SidebarNav
            userRole={session.user.role}
            userName={session.user.name}
          />
        </aside>

        {/* Mobile Header + Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile Header */}
          <header className="flex items-center justify-between border-b bg-card p-4 md:hidden">
            <h1 className="text-lg font-bold">🚛 勤怠管理</h1>
            <span className="text-sm text-muted-foreground">
              {session.user.name}
            </span>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <nav className="flex border-t bg-card md:hidden">
            <MobileNavLink href="/dashboard" icon="📊" label="ホーム" />
            <MobileNavLink href="/dashboard/attendance" icon="⏰" label="出勤簿" />
            <MobileNavLink href="/dashboard/history" icon="📅" label="履歴" />
            <MobileNavLink href="/dashboard/monthly" icon="📈" label="月次" />
          </nav>
        </div>
      </div>
    </SessionProvider>
  );
}

function MobileNavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </a>
  );
}
