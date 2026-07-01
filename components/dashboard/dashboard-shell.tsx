"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { createClient } from "@/lib/supabase/client";

const mobileNavItems = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/dashboard/gastos", label: "Gastos", icon: Receipt },
  { href: "/dashboard/orcamentos", label: "Orçamentos", icon: FileText },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <SidebarNav />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col max-w-full overflow-x-hidden">
        <main className="flex-1 overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-sidebar-border bg-sidebar backdrop-blur-lg md:hidden">
        {mobileNavItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={
                active
                  ? { filter: "drop-shadow(0 0 6px rgba(0,180,255,0.5))" }
                  : undefined
              }
            >
              <Icon className="size-5 shrink-0" />
              <span className="max-w-[54px] truncate text-center leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-5 shrink-0" />
          <span className="leading-none">Sair</span>
        </button>
      </nav>
    </div>
  );
}
