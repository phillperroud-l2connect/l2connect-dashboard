-- L2Connect Dashboard — Migration: adicionar parcelas e moedas à tabela pagamentos
-- Execute no SQL Editor do Supabase se a tabela pagamentos já existir

-- Remove colunas antigas
alter table public.pagamentos
  drop column if exists valor,
  drop column if exists status,
  drop column if exists data_vencimento,
  drop column if exists data_pagamento;

-- Adiciona novas colunas
alter table public.pagamentos
  add column if not exists descricao text,
  add column if not exists moeda text not null default 'BRL'
    check (moeda in ('BRL', 'ARS', 'USD')),
  add column if not exists valor_parcela1 numeric(12, 2) not null default 0,
  add column if not exists data_parcela1 date not null default current_date,
  add column if not exists status_parcela1 text not null default 'pendente'
    check (status_parcela1 in ('pago', 'pendente')),
  add column if not exists valor_parcela2 numeric(12, 2),
  add column if not exists data_parcela2 date,
  add column if not exists status_parcela2 text
    check (status_parcela2 in ('pago', 'pendente')),
;

-- Remove índice antigo e cria novos
drop index if exists idx_pagamentos_data_vencimento;
create index if not exists idx_pagamentos_created_at on public.pagamentos(created_at desc);

-- Recarrega schema da API
notify pgrst, 'reload schema';
