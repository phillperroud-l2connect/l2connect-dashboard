-- =============================================================================
-- L2Connect Dashboard — Setup (clientes já existe com id bigint/int8)
-- Execute no SQL Editor do Supabase (projeto completo, uma vez)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: pagamentos (cliente_id bigint → clientes.id bigint)
-- NÃO altera a tabela clientes existente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id bigint NOT NULL,
  valor numeric(12, 2) NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'cancelado')),
  data_vencimento date NOT NULL,
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagamentos_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE
);

-- Se a tabela pagamentos já existir sem FK ou com tipo errado, ajuste colunas:
DO $$
BEGIN
  -- Cria tabela vazia só com id se não existir (caso edge); normalmente IF NOT EXISTS acima basta
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pagamentos'
  ) THEN
    RAISE NOTICE 'Tabela pagamentos criada pelo CREATE TABLE acima.';
  END IF;

  -- Garante cliente_id como bigint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'cliente_id'
      AND data_type <> 'bigint'
  ) THEN
    RAISE EXCEPTION 'Coluna pagamentos.cliente_id existe com tipo incorreto. Remova a tabela pagamentos vazia (DROP TABLE public.pagamentos;) e execute este script novamente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN cliente_id bigint NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'valor'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN valor numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN descricao text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN status text NOT NULL DEFAULT 'pendente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'data_vencimento'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN data_vencimento date NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'data_pagamento'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN data_pagamento date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.pagamentos ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- FK (somente se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'pagamentos'
      AND constraint_name = 'pagamentos_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente_id ON public.pagamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data_vencimento ON public.pagamentos(data_vencimento);

-- -----------------------------------------------------------------------------
-- 2. TABELA: gastos (id bigint; sem FK para clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gastos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  descricao text NOT NULL,
  valor numeric(12, 2) NOT NULL,
  categoria text,
  data date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE public.gastos ADD COLUMN descricao text;
    UPDATE public.gastos SET descricao = 'Sem descrição' WHERE descricao IS NULL;
    ALTER TABLE public.gastos ALTER COLUMN descricao SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = 'valor'
  ) THEN
    ALTER TABLE public.gastos ADD COLUMN valor numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = 'categoria'
  ) THEN
    ALTER TABLE public.gastos ADD COLUMN categoria text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = 'data'
  ) THEN
    ALTER TABLE public.gastos ADD COLUMN data date NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.gastos ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gastos_data ON public.gastos(data);

-- -----------------------------------------------------------------------------
-- 3. PERMISSÕES (GRANT) — clientes + pagamentos + gastos
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO authenticated;

-- Sequences para colunas IDENTITY (insert com auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.pagamentos FROM anon;
REVOKE ALL ON public.gastos FROM anon;

-- -----------------------------------------------------------------------------
-- 4. RLS — acesso total para usuários autenticados (3 tabelas)
-- -----------------------------------------------------------------------------
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_clientes" ON public.clientes;
DROP POLICY IF EXISTS "authenticated_all_pagamentos" ON public.pagamentos;
DROP POLICY IF EXISTS "authenticated_all_gastos" ON public.gastos;

CREATE POLICY "authenticated_all_clientes"
  ON public.clientes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_pagamentos"
  ON public.pagamentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_gastos"
  ON public.gastos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. Recarregar cache da API
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- 6. Verificação
-- -----------------------------------------------------------------------------
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('clientes', 'pagamentos', 'gastos')
  AND column_name IN ('id', 'cliente_id')
ORDER BY table_name, column_name;

SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clientes', 'pagamentos', 'gastos')
ORDER BY tablename;
