"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Gasto, GastoMoeda, GastoTipo } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatCurrencyUSD, formatDate, toInputDate } from "@/lib/format";

type FormState = {
  descricao: string;
  valor: string;
  moeda: GastoMoeda;
  tipo: GastoTipo;
  categoria: string;
  data: string;
};

const emptyForm: FormState = {
  descricao: "",
  valor: "",
  moeda: "BRL",
  tipo: "recorrente",
  categoria: "",
  data: new Date().toISOString().slice(0, 10),
};

const selectCls =
  "flex h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";

function formatValorGasto(valor: number, moeda: GastoMoeda): string {
  return moeda === "USD" ? formatCurrencyUSD(valor) : formatCurrency(valor);
}

export function GastosManager() {
  const supabase = createClient();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("gastos")
      .select("*")
      .order("data", { ascending: false });

    if (fetchError) setError(fetchError.message);
    else {
      setGastos((data as Gasto[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, data: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  }

  function openEdit(g: Gasto) {
    setEditing(g);
    setForm({
      descricao: g.descricao,
      valor: String(g.valor),
      moeda: (g.moeda ?? "BRL") as GastoMoeda,
      tipo: (g.tipo ?? "recorrente") as GastoTipo,
      categoria: g.categoria ?? "",
      data: toInputDate(g.data),
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor.replace(",", ".")),
      moeda: form.moeda,
      tipo: form.tipo,
      categoria: form.categoria.trim() || null,
      data: form.data,
    };

    let mutationError: string | null = null;

    if (editing) {
      const { error: updateError } = await supabase
        .from("gastos")
        .update(payload)
        .eq("id", editing.id);
      mutationError = updateError?.message ?? null;
    } else {
      const { error: insertError } = await supabase.from("gastos").insert(payload);
      mutationError = insertError?.message ?? null;
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
    if (!confirm("Excluir este gasto?")) return;
    const { error: deleteError } = await supabase.from("gastos").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else await load();
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Registro de despesas e saídas."
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={openCreate}>
                <Plus />
                Novo gasto
              </Button>
            </DialogTrigger>
            <DialogContent title={editing ? "Editar gasto" : "Novo gasto"}>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Input
                    id="descricao"
                    value={form.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                    required
                  />
                </div>

                {/* Moeda + Tipo */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="moeda">Moeda *</Label>
                    <select
                      id="moeda"
                      className={selectCls}
                      value={form.moeda}
                      onChange={(e) => set("moeda", e.target.value as GastoMoeda)}
                    >
                      <option value="BRL">Real (R$)</option>
                      <option value="USD">Dólar (USD)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo *</Label>
                    <select
                      id="tipo"
                      className={selectCls}
                      value={form.tipo}
                      onChange={(e) => set("tipo", e.target.value as GastoTipo)}
                    >
                      <option value="recorrente">Recorrente (mensal)</option>
                      <option value="avulso">Avulso (único)</option>
                    </select>
                  </div>
                </div>

                {form.tipo === "recorrente" && (
                  <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                    Recorrente: o gasto será contabilizado todo mês a partir da data de início.
                  </p>
                )}

                {/* Valor + Data */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="valor">
                      Valor ({form.moeda === "USD" ? "US$" : "R$"}) *
                    </Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.valor}
                      onChange={(e) => set("valor", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data">
                      {form.tipo === "recorrente" ? "Data de início *" : "Data *"}
                    </Label>
                    <Input
                      id="data"
                      type="date"
                      value={form.data}
                      onChange={(e) => set("data", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    placeholder="Ex: Infraestrutura, Marketing..."
                    value={form.categoria}
                    onChange={(e) => set("categoria", e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
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

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : gastos.length === 0 ? (
        <EmptyState message="Nenhum gasto cadastrado." />
      ) : (
        <div
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr
                className="border-b text-left text-muted-foreground"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, i) => {
                const moeda = (g.moeda ?? "BRL") as GastoMoeda;
                const tipo = (g.tipo ?? "recorrente") as GastoTipo;
                return (
                  <tr
                    key={g.id}
                    className="border-b last:border-0 transition-colors hover:bg-white/3"
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: i % 2 !== 0 ? "rgba(255,255,255,0.015)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{g.descricao}</td>
                    <td className="px-4 py-3">
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
                        {tipo === "recorrente" ? "Recorrente" : "Avulso"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={moeda === "USD" ? "text-emerald-400" : ""}>
                        {formatValorGasto(Number(g.valor), moeda)}
                      </span>
                      {moeda === "USD" && (
                        <span className="ml-1 text-[10px] text-muted-foreground">USD</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.categoria ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(g.data)}
                      {tipo === "recorrente" && (
                        <span className="ml-1 text-[10px] opacity-60">↻</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(g)}
                          aria-label="Editar"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(g.id)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
