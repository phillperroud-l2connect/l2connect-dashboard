import {
  Users,
  CreditCard,
  Receipt,
  TrendingDown,
  ArrowLeftRight,
  Wallet,
  RefreshCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { OverviewChart, type ChartDataPoint } from "@/components/dashboard/overview-chart";
import { formatCurrency, formatCurrencyARS, formatDate } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

type PagRow = {
  id: string;
  moeda: string;
  descricao: string | null;
  valor_parcela1: number;
  data_parcela1: string;
  status_parcela1: string;
  valor_parcela2: number | null;
  data_parcela2: string | null;
  status_parcela2: string | null;
  cotacao_ars_brl: number | null;
  created_at: string;
  clientes: { nome: string } | { nome: string }[] | null;
};

type GastoRow = {
  id: string;
  descricao: string | null;
  valor: number;
  moeda: string | null;
  tipo: string | null;
  data: string;
};

// ─── Date helpers ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Build a YYYY-MM-DD string from year + 0-indexed month + day (all UTC-based).
function ymd(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Returns the last calendar day of a month using UTC arithmetic.
function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// Normalize any date string (handles "YYYY-MM-DD" and "YYYY-MM-DDTHH:...") then
// check whether it falls inside [start, end] (inclusive, both in YYYY-MM-DD).
function inRange(dateVal: string | null | undefined, start: string, end: string): boolean {
  if (!dateVal) return false;
  const d = dateVal.slice(0, 10);
  return d >= start && d <= end;
}

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  // Use UTC getters so the result is timezone-independent on any server.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();   // 0-indexed
  const today = now.getUTCDate();

  if (period === "last_30_days") {
    const ago = new Date(Date.UTC(year, month, today - 30));
    return {
      start: ymd(ago.getUTCFullYear(), ago.getUTCMonth(), ago.getUTCDate()),
      end: ymd(year, month, today),
    };
  }

  if (period === "last_3_months") {
    const s = new Date(Date.UTC(year, month - 2, 1));
    return {
      start: ymd(s.getUTCFullYear(), s.getUTCMonth(), 1),
      end: ymd(year, month, lastDayOfMonth(year, month)),
    };
  }

  if (period === "last_semester") {
    const s = new Date(Date.UTC(year, month - 5, 1));
    return {
      start: ymd(s.getUTCFullYear(), s.getUTCMonth(), 1),
      end: ymd(year, month, lastDayOfMonth(year, month)),
    };
  }

  if (period === "year") {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }

  const match = period.match(/^month_(\d{2})$/);
  if (match) {
    const m = parseInt(match[1]) - 1; // 0-indexed month from URL param
    return {
      start: ymd(year, m, 1),
      end: ymd(year, m, lastDayOfMonth(year, m)),
    };
  }

  // default: current_month
  return {
    start: ymd(year, month, 1),
    end: ymd(year, month, lastDayOfMonth(year, month)),
  };
}

function getPeriodLabel(period: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  if (period === "last_30_days") return "Últimos 30 dias";
  if (period === "last_3_months") return "Últimos 3 meses";
  if (period === "last_semester") return "Último semestre";
  if (period === "year") return `Ano completo ${year}`;
  const match = period.match(/^month_(\d{2})$/);
  if (match) return `${MONTH_NAMES[parseInt(match[1]) - 1]} ${year}`;
  return `${MONTH_NAMES[now.getUTCMonth()]} ${year}`;
}

// ─── Rate fetching ───────────────────────────────────────────────────────────

async function fetchArsRate(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/ARS", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = Number(data?.rates?.BRL);
    return isNaN(rate) || rate === 0 ? null : rate;
  } catch {
    return null;
  }
}

async function fetchUsdRate(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = Number(data?.rates?.BRL);
    return isNaN(rate) || rate === 0 ? null : rate;
  } catch {
    return null;
  }
}

// ─── Computation helpers ─────────────────────────────────────────────────────

function computeRecebido(
  pagamentos: PagRow[],
  moeda: string,
  range: { start: string; end: string }
): number {
  let total = 0;
  for (const p of pagamentos) {
    if (p.moeda !== moeda) continue;
    if (p.status_parcela1 === "pago" && inRange(p.data_parcela1, range.start, range.end)) {
      total += Number(p.valor_parcela1);
    }
    if (p.valor_parcela2 != null && p.status_parcela2 === "pago" && inRange(p.data_parcela2, range.start, range.end)) {
      total += Number(p.valor_parcela2);
    }
  }
  return total;
}

function computePendente(pagamentos: PagRow[], moeda: string): number {
  let total = 0;
  for (const p of pagamentos) {
    if (p.moeda !== moeda) continue;
    if (p.status_parcela1 === "pendente") total += Number(p.valor_parcela1);
    if (p.valor_parcela2 != null && p.status_parcela2 === "pendente") total += Number(p.valor_parcela2);
  }
  return total;
}

function ym2n(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + m;
}

function countRecurrenteMonths(
  gastoData: string,
  period: string,
  range: { start: string; end: string },
  now: Date
): number {
  // Multi-month periods: count how many months in the range the expense was active
  if (period === "year" || period === "last_3_months" || period === "last_semester") {
    const gastoN = ym2n(gastoData.slice(0, 7));
    const startN = ym2n(range.start.slice(0, 7));
    const endN = ym2n(range.end.slice(0, 7));
    const nowN = ym2n(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const effStart = Math.max(startN, gastoN);
    const effEnd = Math.min(endN, nowN);
    return effStart <= effEnd ? effEnd - effStart + 1 : 0;
  }
  // Single-month or last_30_days: 1 if expense started on or before period end
  return gastoData.slice(0, 10) <= range.end ? 1 : 0;
}

type GastosResult = {
  totalBRL: number;
  recorrenteBRL: number;
  avulsoBRL: number;
};

function computeGastos(
  gastos: GastoRow[],
  period: string,
  range: { start: string; end: string },
  usdToBrl: number | null,
  now: Date
): GastosResult {
  let totalBRL = 0;
  let recorrenteBRL = 0;
  let avulsoBRL = 0;

  for (const g of gastos) {
    const moeda = g.moeda ?? "BRL";
    const tipo = g.tipo ?? "recorrente";
    const usdFallback = usdToBrl ?? 5.8;
    const valorBRL = moeda === "USD" ? Number(g.valor) * usdFallback : Number(g.valor);

    if (tipo === "recorrente") {
      const count = countRecurrenteMonths(g.data, period, range, now);
      const contribution = valorBRL * count;
      totalBRL += contribution;
      recorrenteBRL += contribution;
    } else {
      if (inRange(g.data, range.start, range.end)) {
        totalBRL += valorBRL;
        avulsoBRL += valorBRL;
      }
    }
  }

  return { totalBRL, recorrenteBRL, avulsoBRL };
}

// Uses stored per-payment rate (cotacao_ars_brl) when available; falls back to
// the current live rate so old records without a stored rate still convert.
function computeConsolidadoBRL(
  pagamentos: PagRow[],
  range: { start: string; end: string },
  currentArsRate: number | null
): number | null {
  let total = 0;
  for (const p of pagamentos) {
    if (p.moeda === "BRL") {
      if (p.status_parcela1 === "pago" && inRange(p.data_parcela1, range.start, range.end)) {
        total += Number(p.valor_parcela1);
      }
      if (p.valor_parcela2 != null && p.status_parcela2 === "pago" && inRange(p.data_parcela2, range.start, range.end)) {
        total += Number(p.valor_parcela2);
      }
    } else if (p.moeda === "ARS") {
      const rate = p.cotacao_ars_brl ?? currentArsRate;
      if (rate == null) return null;
      if (p.status_parcela1 === "pago" && inRange(p.data_parcela1, range.start, range.end)) {
        total += Number(p.valor_parcela1) * rate;
      }
      if (p.valor_parcela2 != null && p.status_parcela2 === "pago" && inRange(p.data_parcela2, range.start, range.end)) {
        total += Number(p.valor_parcela2) * rate;
      }
    }
  }
  return total;
}

// ─── Chart helpers ───────────────────────────────────────────────────────────

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getChartMonths(range: { start: string; end: string }): Array<{ year: number; month0: number }> {
  const [sy, sm] = range.start.split("-").map(Number);
  const [ey, em] = range.end.split("-").map(Number);
  const months: Array<{ year: number; month0: number }> = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month0: m - 1 });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function buildChartData(
  pagamentos: PagRow[],
  gastos: GastoRow[],
  months: Array<{ year: number; month0: number }>,
  usdRate: number | null,
  arsRate: number | null
): ChartDataPoint[] {
  return months.map(({ year, month0 }) => {
    const start = ymd(year, month0, 1);
    const end = ymd(year, month0, lastDayOfMonth(year, month0));
    const monthRange = { start, end };
    const monthPeriod = `month_${String(month0 + 1).padStart(2, "0")}`;
    const receita =
      computeConsolidadoBRL(pagamentos, monthRange, arsRate) ??
      computeRecebido(pagamentos, "BRL", monthRange);
    const g = computeGastos(gastos, monthPeriod, monthRange, usdRate, new Date(Date.UTC(year, month0, 15)));
    return {
      name: MONTH_SHORT[month0],
      receita: Math.round(receita),
      gastos: Math.round(g.totalBRL),
    };
  });
}

function clienteNome(p: PagRow): string {
  const c = p.clientes;
  if (!c) return "Cliente";
  if (Array.isArray(c)) return c[0]?.nome ?? "Cliente";
  return c.nome;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "current_month" } = await searchParams;
  const range = getDateRange(period);
  const periodLabel = getPeriodLabel(period);
  const now = new Date();

  const supabase = await createClient();

  const [
    { count: clientesCount },
    { data: pagamentosRaw },
    { data: gastosRaw },
    arsRate,
    usdRate,
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase
      .from("pagamentos")
      .select(
        "id, moeda, descricao, valor_parcela1, data_parcela1, status_parcela1, valor_parcela2, data_parcela2, status_parcela2, cotacao_ars_brl, created_at, clientes(nome)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("gastos")
      .select("id, descricao, valor, moeda, tipo, data")
      .order("data", { ascending: false }),
    fetchArsRate(),
    fetchUsdRate(),
  ]);

  const pagList = (pagamentosRaw ?? []) as PagRow[];
  const gastosList = (gastosRaw ?? []) as GastoRow[];

  // Received within period
  const recebidoBRL = computeRecebido(pagList, "BRL", range);
  const recebidoARS = computeRecebido(pagList, "ARS", range);

  // All-time pending (period-independent)
  const pendenteBRL = computePendente(pagList, "BRL");
  const pendenteARS = computePendente(pagList, "ARS");

  // Gastos for period (with recorrente logic)
  const gastos = computeGastos(gastosList, period, range, usdRate, now);

  // Consolidado uses per-payment stored rate with live rate as fallback
  const consolidadoBRL = computeConsolidadoBRL(pagList, range, arsRate);
  const hasStoredRate = pagList.some(p => p.moeda === "ARS" && p.cotacao_ars_brl != null);

  // Saldos — saldoBRL inclui ARS convertida (mesma lógica do card Consolidado)
  const saldoBRL = (consolidadoBRL ?? recebidoBRL) - gastos.totalBRL;
  const saldoARS = recebidoARS; // no ARS gastos

  // Last 5 payments and expenses (not period-filtered)
  const ultimosList = pagList.slice(0, 5);
  const ultimosGastos = gastosList.slice(0, 5);

  // Chart data — one entry per calendar month in the selected range
  const chartMonths = getChartMonths(range);
  const chartData = buildChartData(pagList, gastosList, chartMonths, usdRate, arsRate);

  return (
    <div className="max-w-full overflow-x-hidden">
      {/* ── Header + Period Selector ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Visão geral"
          description={`Período: ${periodLabel}`}
        />
        <div className="shrink-0">
          <PeriodSelector />
        </div>
      </div>

      {/* ── Hero: 4 valores em 2 colunas ── */}
      <div
        className="mb-6 rounded-xl border p-5 md:p-6"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "linear-gradient(135deg, rgba(0,180,255,0.06) 0%, rgba(0,30,80,0.04) 100%)",
          boxShadow: "0 0 40px rgba(0,180,255,0.05), 0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Resumo Financeiro · {periodLabel}
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {/* Recebido BRL */}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Recebido BRL</p>
            <p
              className="text-2xl font-bold tracking-tight md:text-3xl"
              style={{ color: "#00b4ff", textShadow: "0 0 20px rgba(0,180,255,0.3)" }}
            >
              {formatCurrency(recebidoBRL)}
            </p>
          </div>

          {/* Recebido ARS */}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Recebido ARS</p>
            <p className="text-2xl font-bold tracking-tight text-amber-400 md:text-3xl">
              {formatCurrencyARS(recebidoARS)}
            </p>
          </div>

          {/* Divider */}
          <div
            className="col-span-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          />

          {/* Saldo BRL */}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Saldo BRL{" "}
              <span className="text-[10px] opacity-60">(BRL + ARS conv. − gastos)</span>
            </p>
            <p
              className="text-2xl font-bold tracking-tight md:text-3xl"
              style={{
                color: saldoBRL >= 0 ? "#00b4ff" : "#ff4d4d",
                textShadow: saldoBRL >= 0
                  ? "0 0 20px rgba(0,180,255,0.25)"
                  : "0 0 20px rgba(255,77,77,0.25)",
              }}
            >
              {formatCurrency(saldoBRL)}
            </p>
            {saldoBRL < 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <TrendingDown className="size-3" /> Déficit no período
              </p>
            )}
          </div>

          {/* Saldo ARS */}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Saldo ARS</p>
            <p className="text-2xl font-bold tracking-tight text-amber-400 md:text-3xl">
              {formatCurrencyARS(saldoARS)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Consolidado em BRL ── */}
      <div className="mb-6">
        <Card style={{ borderColor: "rgba(0,229,160,0.2)", background: "rgba(0,229,160,0.03)" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Consolidado em BRL</CardDescription>
            <div className="flex items-center gap-2">
              {arsRate != null && (
                <span className="text-xs text-muted-foreground">
                  1 ARS = R$ {arsRate.toFixed(5)}
                </span>
              )}
              <div
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ background: "rgba(0,229,160,0.12)" }}
              >
                <ArrowLeftRight className="size-4 text-emerald-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {consolidadoBRL != null ? (
              <>
                <CardTitle className="text-2xl text-emerald-400">
                  {formatCurrency(consolidadoBRL)}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  BRL + ARS convertido · {hasStoredRate ? "cotação histórica" : "cotação atual"} · {periodLabel}
                </p>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl" style={{ color: "#00b4ff" }}>
                  {formatCurrency(recebidoBRL)}
                </CardTitle>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCcw className="size-3" />
                  apenas BRL <span className="text-amber-400/80">(conversão parcial)</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Stats 2×2 / 4col ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* Clientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Clientes</CardDescription>
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(192,96,255,0.12)" }}
            >
              <Users className="size-3.5 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{clientesCount ?? 0}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        {/* Gastos — com breakdown recorrente/avulso */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Gastos</CardDescription>
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(255,77,77,0.12)" }}
            >
              <Receipt className="size-3.5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-destructive">
              {formatCurrency(gastos.totalBRL)}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Recorr.: {formatCurrency(gastos.recorrenteBRL)}
              {" · "}
              Avulso: {formatCurrency(gastos.avulsoBRL)}
            </p>
          </CardContent>
        </Card>

        {/* A Receber BRL — sempre all-time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>A Receber BRL</CardDescription>
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(255,179,0,0.12)" }}
            >
              <CreditCard className="size-3.5 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-amber-400">
              {formatCurrency(pendenteBRL)}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">total pendente</p>
          </CardContent>
        </Card>

        {/* A Receber ARS — sempre all-time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>A Receber ARS</CardDescription>
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(255,179,0,0.12)" }}
            >
              <Wallet className="size-3.5 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-amber-400">
              {formatCurrencyARS(pendenteARS)}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">total pendente</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráfico Receita vs Gastos ── */}
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Receita vs Gastos</h2>
            <p className="text-sm text-muted-foreground">{periodLabel} · BRL</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: "#00b4ff" }} />
              Receita
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: "#ff4d4d" }} />
              Gastos
            </span>
          </div>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <OverviewChart data={chartData} />
        </div>
      </div>

      {/* ── Últimos Pagamentos + Últimos Gastos ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Últimos Pagamentos */}
        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold tracking-tight">Últimos Pagamentos</h2>
            <p className="text-xs text-muted-foreground">5 registros mais recentes</p>
          </div>
          {ultimosList.length === 0 ? (
            <div
              className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              Nenhum pagamento cadastrado.
            </div>
          ) : (
            <ul className="space-y-2">
              {ultimosList.map((p) => {
                const total =
                  Number(p.valor_parcela1) +
                  (p.valor_parcela2 ? Number(p.valor_parcela2) : 0);
                const allPago =
                  p.status_parcela1 === "pago" &&
                  (p.valor_parcela2 == null || p.status_parcela2 === "pago");
                const anyPago =
                  p.status_parcela1 === "pago" || p.status_parcela2 === "pago";
                const statusLabel = allPago ? "pago" : anyPago ? "parcial" : "pendente";
                const statusVariant = allPago
                  ? ("success" as const)
                  : anyPago
                    ? ("warning" as const)
                    : ("destructive" as const);

                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 transition-colors hover:bg-white/3 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor: "rgba(255,255,255,0.07)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {clienteNome(p)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.descricao ?? "Sem descrição"} · {formatDate(p.data_parcela1)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: p.moeda === "ARS"
                            ? "rgba(255,179,0,0.15)"
                            : "rgba(0,180,255,0.12)",
                          color: p.moeda === "ARS" ? "#ffb300" : "#00b4ff",
                          border: `1px solid ${p.moeda === "ARS" ? "rgba(255,179,0,0.25)" : "rgba(0,180,255,0.2)"}`,
                        }}
                      >
                        {p.moeda}
                      </span>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                      <span className="text-sm font-bold">
                        {p.moeda === "ARS"
                          ? formatCurrencyARS(total)
                          : formatCurrency(total)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Últimos Gastos */}
        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold tracking-tight">Últimos Gastos</h2>
            <p className="text-xs text-muted-foreground">5 registros mais recentes</p>
          </div>
          {ultimosGastos.length === 0 ? (
            <div
              className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              Nenhum gasto cadastrado.
            </div>
          ) : (
            <ul className="space-y-2">
              {ultimosGastos.map((g) => {
                const moeda = g.moeda ?? "BRL";
                const tipo = g.tipo ?? "recorrente";
                return (
                  <li
                    key={g.id}
                    className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 transition-colors hover:bg-white/3 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor: "rgba(255,255,255,0.07)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {g.descricao ?? (tipo === "recorrente" ? "Recorrente" : "Avulso")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tipo === "recorrente" ? "Recorrente" : "Avulso"} · {formatDate(g.data)}
                        {tipo === "recorrente" && (
                          <span className="ml-1 opacity-60">↻</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={
                          tipo === "recorrente"
                            ? {
                                background: "rgba(0,180,255,0.12)",
                                color: "#00b4ff",
                                border: "1px solid rgba(0,180,255,0.2)",
                              }
                            : {
                                background: "rgba(255,255,255,0.07)",
                                color: "#8899bb",
                                border: "1px solid rgba(255,255,255,0.12)",
                              }
                        }
                      >
                        {moeda}
                      </span>
                      <span className="text-sm font-bold text-destructive">
                        −{moeda === "USD"
                          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(g.valor)
                          : formatCurrency(g.valor)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
