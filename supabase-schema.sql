-- L2Connect Dashboard — Schema atualizado com parcelas e moedas
-- Execute no SQL Editor do Supabase (novo projeto)
-- Para projetos existentes, use supabase-migration.sql

-- clientes: já existe (id bigint) — não recriar

create table if not exists public.pagamentos (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  descricao text,
  moeda text not null default 'BRL' check (moeda in ('BRL', 'ARS', 'USD')),
  valor_parcela1 numeric(12, 2) not null,
  data_parcela1 date not null,
  status_parcela1 text not null default 'pendente' check (status_parcela1 in ('pago', 'pendente')),
  valor_parcela2 numeric(12, 2),
  data_parcela2 date,
  status_parcela2 text check (status_parcela2 in ('pago', 'pendente')),
  created_at timestamptz not null default now()
);

create index if not exists idx_pagamentos_cliente_id on public.pagamentos(cliente_id);
create index if not exists idx_pagamentos_created_at on public.pagamentos(created_at desc);

create table if not exists public.gastos (
  id bigint generated always as identity primary key,
  descricao text not null,
  valor numeric(12, 2) not null,
  categoria text,
  data date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gastos_data on public.gastos(data);
