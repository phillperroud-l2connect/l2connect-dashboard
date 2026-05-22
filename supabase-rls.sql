-- =============================================================================
-- L2Connect Dashboard — Row Level Security (RLS)
-- Execute no SQL Editor do Supabase após criar as tabelas.
-- Permite que qualquer usuário autenticado acesse todos os dados
-- (modelo single-tenant: um único usuário / equipe por projeto Supabase).
-- =============================================================================

-- ── Habilitar RLS ────────────────────────────────────────────────────────────
alter table public.clientes   enable row level security;
alter table public.pagamentos enable row level security;
alter table public.gastos     enable row level security;

-- ── Remover políticas antigas (idempotente) ───────────────────────────────────
drop policy if exists "authenticated_all_clientes"   on public.clientes;
drop policy if exists "authenticated_all_pagamentos" on public.pagamentos;
drop policy if exists "authenticated_all_gastos"     on public.gastos;

-- ── Políticas: acesso total apenas para usuários autenticados ─────────────────
create policy "authenticated_all_clientes"
  on public.clientes
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_pagamentos"
  on public.pagamentos
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_gastos"
  on public.gastos
  for all
  to authenticated
  using (true)
  with check (true);

-- ── Bloquear acesso anônimo explicitamente ────────────────────────────────────
revoke all on public.clientes   from anon;
revoke all on public.pagamentos from anon;
revoke all on public.gastos     from anon;

-- ── Garantir permissões para usuários autenticados ───────────────────────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.clientes   to authenticated;
grant select, insert, update, delete on public.pagamentos to authenticated;
grant select, insert, update, delete on public.gastos     to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ── Verificação ──────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('clientes', 'pagamentos', 'gastos')
order by tablename, policyname;
