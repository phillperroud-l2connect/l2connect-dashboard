"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Gasto } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate, toInputDate } from "@/lib/format";

type FormState = {
  descricao: string;
  valor: string;
  categoria: string;
  data: string;
};

const emptyForm: FormState = {
  descricao: "",
  valor: "",
  categoria: "",
  data: new Date().toISOString().slice(0, 10),
};

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
    setForm({
      ...emptyForm,
      data: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  }

  function openEdit(g: Gasto) {
    setEditing(g);
    setForm({
      descricao: g.descricao,
      valor: String(g.valor),
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
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Input
                    id="descricao"
                    value={form.descricao}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, descricao: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$) *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.valor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, valor: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={form.data}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, data: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    placeholder="Ex: Infraestrutura, Marketing..."
                    value={form.categoria}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoria: e.target.value }))
                    }
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
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, i) => (
                <tr key={g.id} className="border-b last:border-0 transition-colors hover:bg-white/3" style={{ borderColor: "rgba(255,255,255,0.06)", background: i % 2 !== 0 ? "rgba(255,255,255,0.015)" : undefined }}>
                  <td className="px-4 py-3 font-medium">{g.descricao}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {g.categoria ?? "—"}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(Number(g.valor))}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(g.data)}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
