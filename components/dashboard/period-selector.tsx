"use client";

import { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const now = new Date();
  const year = now.getFullYear();
  const currentMonthValue = `month_${String(now.getMonth() + 1).padStart(2, "0")}`;
  const period = sp.get("period") ?? currentMonthValue;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    params.set("period", e.target.value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative flex items-center">
      <CalendarDays
        className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
      />
      <select
        value={period}
        onChange={onChange}
        className="h-9 appearance-none rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
      >
        <option value={currentMonthValue}>Mês atual</option>
        <option value="last_30_days">Últimos 30 dias</option>
        <option value="last_3_months">Últimos 3 meses</option>
        <option value="last_semester">Último semestre</option>
        <option disabled>──────────────</option>
        {MONTHS.map((name, i) => (
          <option key={i} value={`month_${String(i + 1).padStart(2, "0")}`}>
            {name} {year}
          </option>
        ))}
        <option disabled>──────────────</option>
        <option value="year">Ano completo {year}</option>
      </select>
    </div>
  );
}

export function PeriodSelector() {
  return (
    <Suspense
      fallback={
        <div className="h-9 w-48 animate-pulse rounded-lg bg-white/5" />
      }
    >
      <Inner />
    </Suspense>
  );
}
