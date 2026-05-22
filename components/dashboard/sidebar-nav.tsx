"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/dashboard/gastos", label: "Gastos", icon: Receipt },
  { href: "/dashboard/orcamentos", label: "Orçamentos", icon: FileText },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Image
          src="/l2connect-logo.png"
          alt="L2Connect"
          width={160}
          height={40}
          style={{ height: "40px", width: "auto" }}
          unoptimized
          priority
        />
      </div>

      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
