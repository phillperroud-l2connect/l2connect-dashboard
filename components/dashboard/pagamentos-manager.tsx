"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Pagamento, Moeda, ParcelaStatus } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  formatCurrency,
  formatCurrencyARS,

  formatDate,
  toInputDate,
} from "@/lib/format";

type PagamentoRow = Pagamento & { clientes: { nome: string } | null };

type FormState = {
  cliente_id: string;
  descricao: string;
  moeda: Moeda;
  valor_parcela1: string;
  data_parcela1: string;
  status_parcela1: ParcelaStatus;
  tem_parcela2: boolean;
  valor_parcela2: string;
  data_parcela2: string;
  status_parcela2: ParcelaStatus;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm: FormState = {
  cliente_id: "",
  descricao: "",
  moeda: "BRL",
  valor_parcela1: "",
  data_parcela1: today,
  status_parcela1: "pendente",
  tem_parcela2: false,
  valor_parcela2: "",
  data_parcela2: today,
  status_parcela2: "pendente",
};

function parcelaBadge(status: ParcelaStatus) {
  return status === "pago" ? ("success" as const) : ("warning" as const);
}

function formatValor(valor: number, moeda: Moeda) {
  if (moeda === "ARS") return formatCurrencyARS(valor);
  return formatCurrency(valor);
}

const selectCls =
  "flex h-9 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm text-foreground";

export function PagamentosManager() {
  const supabase = createClient();
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PagamentoRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [pagRes, cliRes] = await Promise.all([
      supabase
        .from("pagamentos")
        .select("*, clientes(nome)")
        .order("created_at", { ascending: false }),
      supabase.from("clientes").select("*").order("nome"),
    ]);
    if (pagRes.error) setError(pagRes.error.message);
    else {
      setPagamentos((pagRes.data as PagamentoRow[]) ?? []);
      setError(null);
    }
    if (!cliRes.error) setClientes((cliRes.data as Cliente[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, cliente_id: clientes[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(p: PagamentoRow) {
    setEditing(p);
    setForm({
      cliente_id: p.cliente_id,
      descricao: p.descricao ?? "",
      moeda: p.moeda,
      valor_parcela1: String(p.valor_parcela1),
      data_parcela1: toInputDate(p.data_parcela1),
      status_parcela1: p.status_parcela1,
      tem_parcela2: p.valor_parcela2 != null,
      valor_parcela2: p.valor_parcela2 != null ? String(p.valor_parcela2) : "",
      data_parcela2: toInputDate(p.data_parcela2),
      status_parcela2: p.status_parcela2 ?? "pendente",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parse = (v: string) => parseFloat(v.replace(",", ".")) || 0;

    const payload = {
      cliente_id: form.cliente_id,
      descricao: form.descricao.trim() || null,
      moeda: form.moeda,
      valor_parcela1: parse(form.valor_parcela1),
      data_parcela1: form.data_parcela1,
      status_parcela1: form.status_parcela1,
      valor_parcela2: form.tem_parcela2 ? parse(form.valor_parcela2) : null,
      data_parcela2: form.tem_parcela2 && form.data_parcela2 ? form.data_parcela2 : null,
      status_parcela2: form.tem_parcela2 ? form.status_parcela2 : null,
    };

    let mutationError: string | null = null;
    if (editing) {
      const { error: e } = await supabase
        .from("pagamentos")
        .update(payload)
        .eq("id", editing.id);
      mutationError = e?.message ?? null;
    } else {
      const { error: e } = await supabase.from("pagamentos").insert(payload);
      mutationError = e?.message ?? null;
    }

    setSaving(false);
    if (mutationError) {
      setError(mutationError);
      return;
    }
    setDialogOpen(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este pagamento?")) return;
    const { error: e } = await supabase.from("pagamentos").delete().eq("id", id);
    if (e) setError(e.message);
    else await load();
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description="Controle de cobranças com parcelas e moedas."
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                onClick={openCreate}
                disabled={clientes.length === 0}
              >
                <Plus />
                Novo pagamento
              </Button>
            </DialogTrigger>
            <DialogContent title={editing ? "Editar pagamento" : "Novo pagamento"}>
              <form
                onSubmit={handleSubmit}
                className="max-h-[72vh] space-y-4 overflow-y-auto pr-1"
              >
                {/* Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="cliente_id">Cliente *</Label>
                  <select
                    id="cliente_id"
                    className={selectCls}
                    value={form.cliente_id}
                    onChange={(e) => set("cliente_id", e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Moeda + Descrição */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="moeda">Moeda *</Label>
                    <select
                      id="moeda"
                      className={selectCls}
                      value={form.moeda}
                      onChange={(e) => set("moeda", e.target.value as Moeda)}
                    >
                      <option value="BRL">Real (R$)</option>
                      <option value="ARS">Peso Argentino (ARS)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Input
                      id="descricao"
                      value={form.descricao}
                      onChange={(e) => set("descricao", e.target.value)}
                    />
                  </div>
                </div>

                {/* Parcela 1 */}
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Parcela 1
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="valor_p1">Valor *</Label>
                      <Input
                        id="valor_p1"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={form.valor_parcela1}
                        onChange={(e) => set("valor_parcela1", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_p1">Data *</Label>
                      <Input
                        id="data_p1"
                        type="date"
                        value={form.data_parcela1}
                        onChange={(e) => set("data_parcela1", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status_p1">Status *</Label>
                      <select
                        id="status_p1"
                        className={selectCls}
                        value={form.status_parcela1}
                        onChange={(e) =>
                          set("status_parcela1", e.target.value as ParcelaStatus)
                        }
                      >
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Toggle parcela 2 */}
                <button
                  type="button"
                  onClick={() => set("tem_parcela2", !form.tem_parcela2)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  {form.tem_parcela2 ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  {form.tem_parcela2 ? "Remover 2ª parcela" : "Adicionar 2ª parcela"}
                </button>

                {/* Parcela 2 */}
                {form.tem_parcela2 && (
                  <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Parcela 2
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="valor_p2">Valor</Label>
                        <Input
                          id="valor_p2"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={form.valor_parcela2}
                          onChange={(e) => set("valor_parcela2", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="data_p2">Data</Label>
                        <Input
                          id="data_p2"
                          type="date"
                          value={form.data_parcela2}
                          onChange={(e) => set("data_parcela2", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status_p2">Status</Label>
                        <select
                          id="status_p2"
                          className={selectCls}
                          value={form.status_parcela2}
                          onChange={(e) =>
                            set("status_parcela2", e.target.value as ParcelaStatus)
                          }
                        >
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}


                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {clientes.length === 0 && !loading ? (
        <p className="mb-4 text-sm text-amber-400">
          Cadastre pelo menos um cliente antes de criar pagamentos.
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : pagamentos.length === 0 ? (
        <EmptyState message="Nenhum pagamento cadastrado." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Moeda</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Parcela 1</th>
                <th className="px-4 py-3 font-medium">Parcela 2</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-3 font-medium">{p.clientes?.nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-border/60 px-2 py-0.5 text-xs font-semibold">
                      {p.moeda}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.descricao ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {formatValor(Number(p.valor_parcela1), p.moeda)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={parcelaBadge(p.status_parcela1)}>
                          {p.status_parcela1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(p.data_parcela1)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.valor_parcela2 != null ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {formatValor(Number(p.valor_parcela2), p.moeda)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={parcelaBadge(p.status_parcela2 ?? "pendente")}>
                            {p.status_parcela2 ?? "pendente"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(p.data_parcela2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(p)}
                        aria-label="Editar"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(p.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
