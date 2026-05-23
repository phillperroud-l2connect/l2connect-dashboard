"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Cliente } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

type FormState = {
  nome: string;
  email: string;
  telefone: string;
};

const emptyForm: FormState = { nome: "", email: "", telefone: "" };

export function ClientesManager() {
  const supabase = createClient();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setClientes((data as Cliente[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(cliente: Cliente) {
    setEditing(cliente);
    setForm({
      nome: cliente.nome,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
    };

    let mutationError: string | null = null;

    if (editing) {
      const { error: updateError } = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", editing.id);
      mutationError = updateError?.message ?? null;
    } else {
      const { error: insertError } = await supabase
        .from("clientes")
        .insert(payload);
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
    if (!confirm("Excluir este cliente? Pagamentos vinculados podem ser afetados.")) {
      return;
    }
    const { error: deleteError } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      await load();
    }
  }

  return (
    <div className="overflow-x-hidden">
      <PageHeader
        title="Clientes"
        description="Cadastro e gestão de clientes."
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={openCreate}>
                <Plus />
                Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent title={editing ? "Editar cliente" : "Novo cliente"}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nome: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={form.telefone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, telefone: e.target.value }))
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
      ) : clientes.length === 0 ? (
        <EmptyState message="Nenhum cliente cadastrado." />
      ) : (
        <div
          className="rounded-xl border"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-muted-foreground"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {/* Nome — always visible */}
                <th className="px-4 py-3 font-medium">Nome</th>
                {/* E-mail — desktop only */}
                <th className="hidden px-4 py-3 font-medium md:table-cell">E-mail</th>
                {/* Telefone — desktop only */}
                <th className="hidden px-4 py-3 font-medium md:table-cell">Telefone</th>
                {/* Cadastro — desktop only */}
                <th className="hidden px-4 py-3 font-medium md:table-cell">Cadastro</th>
                {/* Ações — always visible */}
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 transition-colors hover:bg-white/3"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background:
                      i % 2 !== 0 ? "rgba(255,255,255,0.015)" : undefined,
                  }}
                >
                  {/* Nome — with sub-info on mobile */}
                  <td className="max-w-0 px-4 py-3">
                    <p className="truncate font-medium">{c.nome}</p>
                    {/* Mobile: show email, telefone and data below nome */}
                    <div className="mt-1 space-y-0.5 md:hidden">
                      {c.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {c.email}
                        </p>
                      )}
                      {c.telefone && (
                        <p className="text-xs text-muted-foreground">
                          {c.telefone}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </p>
                    </div>
                  </td>
                  {/* E-mail — desktop only */}
                  <td className="hidden max-w-[180px] px-4 py-3 text-muted-foreground md:table-cell">
                    <p className="truncate">{c.email ?? "—"}</p>
                  </td>
                  {/* Telefone — desktop only */}
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {c.telefone ?? "—"}
                  </td>
                  {/* Cadastro — desktop only */}
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatDate(c.created_at)}
                  </td>
                  {/* Ações — always visible */}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(c)}
                        aria-label="Editar"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(c.id)}
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
