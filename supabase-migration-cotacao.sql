-- Migration: add cotacao_ars_brl column to pagamentos
-- Run this once in the Supabase SQL Editor

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS cotacao_ars_brl numeric(12, 6);
