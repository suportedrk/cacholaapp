-- ============================================================
-- Migration 146 — Central de Serviços: Agenda de Contatos (Bloco C1)
-- Cria a tabela GLOBAL central_servicos_contatos (pessoas da empresa) e o
-- bucket PRIVADO de fotos. Reaproveita o módulo RBAC central_servicos — sem
-- módulo novo. NÃO inclui ainda o conceito de "grupo"/membros (parte C2).
--
-- LGPD: agenda interna de trabalho (base legal: legítimo interesse / execução
-- do contrato — art. 7). Minimização (art. 6 III): só contatos corporativos.
-- Retenção (art. 16): ao sair, o contato é INATIVADO (some para todos), só a
-- Diretoria exclui em definitivo. Sem exclusão automática, sem consentimento.
--
-- Módulo GLOBAL: sem unit_id, sem filtro por unidade. A coluna `unidade` é
-- apenas INFORMATIVA (geral/pinheiros/moema), nunca trava de segurança.
--
-- RLS REFORÇADA (a diferença-chave vs Bloco B): inativos NÃO são retornados
-- pela própria RLS para quem só tem view — não depende do cliente filtrar.
--   SELECT → ativo = true OR check_permission(edit)   (só edit vê inativos)
--   INSERT → check_permission(create)
--   UPDATE → check_permission(edit)
--   DELETE → check_permission(delete)
--
-- Rollback: 146_central_servicos_contatos_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. TABELA ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.central_servicos_contatos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  setor       text,
  cargo       text,
  unidade     text        NOT NULL DEFAULT 'geral'
              CHECK (unidade IN ('geral', 'pinheiros', 'moema')),  -- informativo
  email       text,
  telefone    text,
  foto_path   text,                                   -- caminho no storage (privado)
  ativo       boolean     NOT NULL DEFAULT true,
  ordem       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_central_servicos_contatos_ordem
  ON public.central_servicos_contatos (ativo, ordem, nome);

COMMENT ON TABLE public.central_servicos_contatos IS
  'Agenda de contatos (pessoas da empresa). Tabela GLOBAL, sem unit_id. RLS via módulo central_servicos; inativos só visíveis a quem tem edit. unidade é informativa.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.central_servicos_contatos TO authenticated;

-- ── 2. TRIGGER updated_at ────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_central_servicos_contatos_updated_at
  BEFORE UPDATE ON public.central_servicos_contatos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS REFORÇADA NA TABELA ───────────────────────────────
ALTER TABLE public.central_servicos_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_servicos_contatos: view"   ON public.central_servicos_contatos;
DROP POLICY IF EXISTS "central_servicos_contatos: create" ON public.central_servicos_contatos;
DROP POLICY IF EXISTS "central_servicos_contatos: edit"   ON public.central_servicos_contatos;
DROP POLICY IF EXISTS "central_servicos_contatos: delete" ON public.central_servicos_contatos;

-- view: quem tem central_servicos.view vê ATIVOS; inativos só com edit.
-- (super_admin e diretor têm edit → veem inativos; check_permission bypassa super_admin)
CREATE POLICY "central_servicos_contatos: view" ON public.central_servicos_contatos
  FOR SELECT TO authenticated
  USING (
    public.check_permission(auth.uid(), 'central_servicos', 'view')
    AND (
      ativo = true
      OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
    )
  );

CREATE POLICY "central_servicos_contatos: create" ON public.central_servicos_contatos
  FOR INSERT TO authenticated
  WITH CHECK (public.check_permission(auth.uid(), 'central_servicos', 'create'));

CREATE POLICY "central_servicos_contatos: edit" ON public.central_servicos_contatos
  FOR UPDATE TO authenticated
  USING (public.check_permission(auth.uid(), 'central_servicos', 'edit'))
  WITH CHECK (public.check_permission(auth.uid(), 'central_servicos', 'edit'));

CREATE POLICY "central_servicos_contatos: delete" ON public.central_servicos_contatos
  FOR DELETE TO authenticated
  USING (public.check_permission(auth.uid(), 'central_servicos', 'delete'));

-- ── 4. BUCKET PRIVADO DE FOTOS ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'central-servicos-contatos',
  'central-servicos-contatos',
  false,                                              -- PRIVADO
  5242880,                                            -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS DO STORAGE (gateada por check_permission) ─────────
-- Leitura: central_servicos.view (signed URL exige passar nesta policy).
-- Como o contato inativo não retorna pela RLS da tabela para quem só lê, o
-- foto_path dele também não vaza. Upload: create/edit. Remoção: delete/edit.
DROP POLICY IF EXISTS "central-servicos-contatos: select" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-contatos: insert" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-contatos: update" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-contatos: delete" ON storage.objects;

CREATE POLICY "central-servicos-contatos: select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'central-servicos-contatos'
    AND public.check_permission(auth.uid(), 'central_servicos', 'view')
  );

CREATE POLICY "central-servicos-contatos: insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'central-servicos-contatos'
    AND (
      public.check_permission(auth.uid(), 'central_servicos', 'create')
      OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
    )
  );

CREATE POLICY "central-servicos-contatos: update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'central-servicos-contatos'
    AND public.check_permission(auth.uid(), 'central_servicos', 'edit')
  );

CREATE POLICY "central-servicos-contatos: delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'central-servicos-contatos'
    AND (
      public.check_permission(auth.uid(), 'central_servicos', 'delete')
      OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
    )
  );

-- ── 6. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
