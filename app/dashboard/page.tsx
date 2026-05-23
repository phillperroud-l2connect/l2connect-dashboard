import {
  Users,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowLeftRight,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCurrencyARS, formatDate } from "@/lib/format";

type TodoPagamento = {
  moeda: string;
  valor_parcela1: number;
  status_parcela1: string;
  valor_parcela2: number | null;
  status_parcela2: string | null;
};

type UltimoPagamento = {
  id: string;
  moeda: string;
  descricao: string | null;
  valor_parcela1: number;
  status_parcela1: string;
  valor_parcela2: number | null;
  status_parcela2: string | null;
  created_at: string;
  clientes: { nome: string } | { nome: string }[] | null;
};

async function fetchArsRate(): Promise<number | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/ARS-BRL", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const bid = parseFloat(data?.ARSBRL?.bid);
    return isNaN(bid) ? null : bid;
  } catch {
    return null;
  }
}

function sumParcelas(pagamentos: TodoPagamento[], moeda: string): number {
  return pagamentos
    .filter((p) => p.moeda === moeda)
    .reduce((sum, p) => {
      return (
        sum + Number(p.valor_parcela1) + (p.valor_parcela2 ? Number(p.valor_parcela2) : 0)
      );
    }, 0);
}

function sumParcelasPago(pagamentos: TodoPagamento[], moeda: string): number {
  return pagamentos
    .filter((p) => p.moeda === moeda)
    .reduce((sum, p) => {
      const p1 = p.status_parcela1 === "pago" ? Number(p.valor_parcela1) : 0;
      const p2 =
        p.status_parcela2 === "pago" && p.valor_parcela2 ? Number(p.valor_parcela2) : 0;
      return sum + p1 + p2;
    }, 0);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: clientesCount },
    { data: todosPagamentos },
    { data: ultimosPagamentos },
    { data: gastos },
    arsRate,
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase
      .from("pagamentos")
      .select("moeda, valor_parcela1, status_parcela1, valor_parcela2, status_parcela2"),
    supabase
      .from("pagamentos")
      .select(
        "id, moeda, descricao, valor_parcela1, status_parcela1, valor_parcela2, status_parcela2, created_at, clientes(nome)"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("gastos").select("valor"),
    fetchArsRate(),
  ]);

  const pagList = (todosPagamentos ?? []) as TodoPagamento[];
  const ultimosList = (ultimosPagamentos ?? []) as UltimoPagamento[];

  function clienteNome(p: UltimoPagamento) {
    const c = p.clientes;
    if (!c) return "Cliente";
    if (Array.isArray(c)) return c[0]?.nome ?? "Cliente";
    return c.nome;
  }

  const totalRecebidoBRL = sumParcelasPago(pagList, "BRL");
  const totalRecebidoARS = sumParcelasPago(pagList, "ARS");
  const totalBRL = sumParcelas(pagList, "BRL");
  const totalARS = sumParcelas(pagList, "ARS");
  const totalGastos = (gastos ?? []).reduce((sum, g) => sum + Number(g.valor), 0);
  const saldo = totalRecebidoBRL - totalGastos;

  const pendenteBRL = totalBRL - totalRecebidoBRL;
  const pendenteARS = totalARS - totalRecebidoARS;

  const totalConsolidado =
    arsRate != null ? totalRecebidoBRL + totalRecebidoARS * arsRate : null;

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title="Visão geral"
        description="Resumo financeiro do L2Connect."
      />

      {/* ── Hero: Saldo BRL ── */}
      <div
        className="mb-6 rounded-xl border p-5 md:p-6"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: saldo >= 0
            ? "linear-gradient(135deg, rgba(0,180,255,0.07) 0%, rgba(0,100,200,0.03) 100%)"
            : "linear-gradient(135deg, rgba(255,77,77,0.07) 0%, rgba(180,0,0,0.03) 100%)",
          boxShadow: saldo >= 0
            ? "0 0 40px rgba(0,180,255,0.06), 0 4px 24px rgba(0,0,0,0.3)"
            : "0 0 40px rgba(255,77,77,0.06), 0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Saldo BRL — recebido menos gastos
        </p>
        <p
          className="text-4xl font-bold tracking-tight md:text-5xl"
          style={
            saldo >= 0
              ? { color: "#00b4ff", textShadow: "0 0 30px rgba(0,180,255,0.35)" }
              : { color: "#ff4d4d", textShadow: "0 0 30px rgba(255,77,77,0.3)" }
          }
        >
          {formatCurrency(saldo)}
        </p>
        {saldo < 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <TrendingDown className="size-3.5" />
            Saldo negativo — gastos superam recebimentos
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5 text-primary" />
            Saldo positivo
          </p>
        )}
      </div>

      {/* ── Totais por moeda ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {/* Total BRL */}
        <Card style={{ borderColor: "rgba(0,180,255,0.2)", background: "rgba(0,180,255,0.04)" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Total em Reais</CardDescription>
            <div
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ background: "rgba(0,180,255,0.12)" }}
            >
              <TrendingUp className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl" style={{ color: "#00b4ff" }}>
              {formatCurrency(totalRecebidoBRL)}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Pendente: {formatCurrency(pendenteBRL)}
            </p>
          </CardContent>
        </Card>

        {/* Total ARS */}
        <Card style={{ borderColor: "rgba(255,179,0,0.2)", background: "rgba(255,179,0,0.04)" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Total em Pesos (ARS)</CardDescription>
            <div
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ background: "rgba(255,179,0,0.12)" }}
            >
              <DollarSign className="size-4 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-amber-400">
              {formatCurrencyARS(totalRecebidoARS)}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Pendente: {formatCurrencyARS(pendenteARS)}
            </p>
          </CardContent>
        </Card>

        {/* Consolidado */}
        <Card style={{ borderColor: "rgba(0,229,160,0.2)", background: "rgba(0,229,160,0.04)" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Consolidado em BRL</CardDescription>
            <div
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ background: "rgba(0,229,160,0.12)" }}
            >
              <ArrowLeftRight className="size-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            {totalConsolidado != null ? (
              <>
                <CardTitle className="text-2xl text-emerald-400">
                  {formatCurrency(totalConsolidado)}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Câmbio ARS/BRL: {arsRate?.toFixed(4)}
                </p>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl text-muted-foreground">
                  {formatCurrency(totalBRL)}
                </CardTitle>
                <p className="mt-1 text-xs text-amber-400">Câmbio indisponível</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Stats: 2×2 mobile / 4 colunas desktop ── */}
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

        {/* Gastos */}
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
              {formatCurrency(totalGastos)}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">total registrado</p>
          </CardContent>
        </Card>

        {/* A Receber BRL */}
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
            <p className="mt-0.5 text-xs text-muted-foreground">pendente</p>
          </CardContent>
        </Card>

        {/* A Receber ARS */}
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
            <p className="mt-0.5 text-xs text-muted-foreground">pendente</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Últimos pagamentos ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Últimos pagamentos</h2>
            <p className="text-sm text-muted-foreground">Os 5 registros mais recentes.</p>
          </div>
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
                    {/* Moeda tag */}
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
                    {/* Status badge */}
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                    {/* Valor */}
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
