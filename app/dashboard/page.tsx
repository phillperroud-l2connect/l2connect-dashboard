import {
  Users,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowLeftRight,
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
    <div>
      <PageHeader
        title="Visão geral"
        description="Resumo financeiro do L2Connect."
      />

      {/* Saldo BRL */}
      <div className="mb-6 rounded-xl border bg-card p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Saldo BRL (recebido − gastos)</p>
        <p
          className={`mt-1 text-3xl font-bold ${saldo >= 0 ? "text-emerald-400" : "text-destructive"}`}
        >
          {formatCurrency(saldo)}
        </p>
        {saldo < 0 ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="size-3" /> Saldo negativo
          </p>
        ) : null}
      </div>

      {/* Totais por moeda */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Total em Reais</CardDescription>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-xl text-primary">
              {formatCurrency(totalRecebidoBRL)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Pendente: {formatCurrency(pendenteBRL)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Total em Pesos (ARS)</CardDescription>
            <DollarSign className="size-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-xl text-amber-400">
              {formatCurrencyARS(totalRecebidoARS)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Pendente: {formatCurrencyARS(pendenteARS)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium">Consolidado em BRL</CardDescription>
            <ArrowLeftRight className="size-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {totalConsolidado != null ? (
              <>
                <CardTitle className="text-xl text-emerald-400">
                  {formatCurrency(totalConsolidado)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Câmbio ARS/BRL: {arsRate?.toFixed(4)}
                </p>
              </>
            ) : (
              <>
                <CardTitle className="text-xl text-muted-foreground">
                  {formatCurrency(totalBRL)}
                </CardTitle>
                <p className="text-xs text-amber-400">
                  Câmbio ARS indisponível
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Clientes</CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl">{clientesCount ?? 0}</CardTitle>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Gastos</CardDescription>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-destructive">
              {formatCurrency(totalGastos)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">total registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>A Receber (BRL)</CardDescription>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-amber-400">
              {formatCurrency(pendenteBRL)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">parcelas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>A Receber (ARS)</CardDescription>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-amber-400">
              {formatCurrencyARS(pendenteARS)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">parcelas pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Últimos pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos pagamentos</CardTitle>
          <CardDescription>Os 5 registros mais recentes.</CardDescription>
        </CardHeader>
        <CardContent>
          {ultimosList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento cadastrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ultimosList.map((p) => {
                const total =
                  Number(p.valor_parcela1) +
                  (p.valor_parcela2 ? Number(p.valor_parcela2) : 0);
                const allPago =
                  p.status_parcela1 === "pago" &&
                  (p.valor_parcela2 == null || p.status_parcela2 === "pago");
                const anyPago =
                  p.status_parcela1 === "pago" || p.status_parcela2 === "pago";
                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{clienteNome(p)}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.descricao ?? "Sem descrição"} ·{" "}
                        <span className="rounded border border-border/60 px-1 text-xs">
                          {p.moeda}
                        </span>
                        {" · "}
                        {formatDate(p.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs ${
                          allPago
                            ? "text-emerald-400"
                            : anyPago
                              ? "text-amber-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {allPago ? "pago" : anyPago ? "parcial" : "pendente"}
                      </span>
                      <span className="font-semibold">
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
        </CardContent>
      </Card>
    </div>
  );
}
