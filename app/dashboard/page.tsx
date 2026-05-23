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
  created_at: string;
  clientes: { nome: string } | { nome: string }[] | null;
};

type GastoRow = {
  id: string;
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

function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "last_30_days") {
    const end = yyyymmdd(now);
    const start = yyyymmdd(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    return { start, end };
  }
  if (period === "year") {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  const match = period.match(/^month_(\d{2})$/);
  if (match) {
    const m = parseInt(match[1]) - 1;
    const start = new Date(year, m, 1);
    const end = new Date(year, m + 1, 0);
    return { start: yyyymmdd(start), end: yyyymmdd(end) };
  }
  // default: current_month
  return {
    start: yyyymmdd(new Date(year, month, 1)),
    end: yyyymmdd(new Date(year, month + 1, 0)),
  };
}

function getPeriodLabel(period: string): string {
  const year = new Date().getFullYear();
  if (period === "last_30_days") return "Últimos 30 dias";
  if (period === "year") return `Ano completo ${year}`;
  const match = period.match(/^month_(\d{2})$/);
  if (match) return `${MONTH_NAMES[parseInt(match[1]) - 1]} ${year}`;
  const m = new Date().getMonth();
  return `${MONTH_NAMES[m]} ${year}`;
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
    if (p.status_parcela1 === "pago" && p.data_parcela1 >= range.start && p.data_parcela1 <= range.end) {
      total += Number(p.valor_parcela1);
    }
    if (p.valor_parcela2 != null && p.status_parcela2 === "pago" && p.data_parcela2 && p.data_parcela2 >= range.start && p.data_parcela2 <= range.end) {
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
  if (period === "year") {
    const gastoN = ym2n(gastoData.slice(0, 7));
    const startN = ym2n(range.start.slice(0, 7));
    const endN = ym2n(range.end.slice(0, 7));
    const nowN = ym2n(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const effStart = Math.max(startN, gastoN);
    const effEnd = Math.min(endN, nowN);
    return effStart <= effEnd ? effEnd - effStart + 1 : 0;
  }
  return gastoData <= range.end ? 1 : 0;
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
      if (g.data >= range.start && g.data <= range.end) {
        totalBRL += valorBRL;
        avulsoBRL += valorBRL;
      }
    }
  }

  return { totalBRL, recorrenteBRL, avulsoBRL };
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
        "id, moeda, descricao, valor_parcela1, data_parcela1, status_parcela1, valor_parcela2, data_parcela2, status_parcela2, created_at, clientes(nome)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("gastos")
      .select("id, valor, moeda, tipo, data")
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

  // Saldos
  const saldoBRL = recebidoBRL - gastos.totalBRL;
  const saldoARS = recebidoARS; // no ARS gastos

  // Consolidado (period-filtered)
  const consolidadoBRL = arsRate != null
    ? recebidoBRL + recebidoARS * arsRate
    : null;

  // Last 5 payments (not period-filtered)
  const ultimosList = pagList.slice(0, 5);

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
              <span className="text-[10px] opacity-60">(recebido − gastos)</span>
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
                  BRL + ARS convertido · {periodLabel}
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

      {/* ── Últimos pagamentos (sem filtro de período) ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight">Últimos pagamentos</h2>
          <p className="text-sm text-muted-foreground">Os 5 registros mais recentes.</p>
        </div>

        {ultimosList.length === 0 ? (
          <div
            className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground"
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
                  className="flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors hover:bg-white/3 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    borderColor: "rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {clienteNome(p)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.descricao ?? "Sem descrição"} · {formatDate(p.created_at)}
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
                    <span className="font-bold">
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
    </div>
  );
}
