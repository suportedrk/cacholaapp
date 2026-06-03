-- ============================================================
-- Migration 145 — Central de Serviços: tabela de Links úteis (Bloco B)
-- Cria a tabela GLOBAL `central_servicos_links` (atalhos para sistemas/
-- portais da empresa) com RLS gateada pelo módulo RBAC 'central_servicos'
-- (reaproveita o módulo do Bloco A — NÃO cria módulo novo).
--
-- Módulo GLOBAL: sem unit_id, sem filtro por unidade. Todos os colaboradores
-- veem os mesmos links.
--
-- RLS (via check_permission, 3 args):
--   SELECT → central_servicos.view   (todos os cargos)
--   INSERT → central_servicos.create (super_admin + diretor)
--   UPDATE → central_servicos.edit   (super_admin + diretor)
--   DELETE → central_servicos.delete (super_admin + diretor)
--
-- Rollback: 145_central_servicos_links_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. TABELA ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.central_servicos_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  descricao   text,                                   -- curta, opcional
  categoria   text        NOT NULL
              CHECK (categoria IN (
                'comercial', 'financeiro', 'rh', 'operacional',
                'bi_gestao', 'ti_sistemas', 'comunicacao', 'outros'
              )),
  url         text        NOT NULL,
  icone_url   text,                                   -- override manual do ícone (opcional)
  ativo       boolean     NOT NULL DEFAULT true,
  ordem       integer     NOT NULL DEFAULT 0,         -- ordena cards dentro da categoria
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_central_servicos_links_categoria_ordem
  ON public.central_servicos_links (categoria, ordem);

COMMENT ON TABLE public.central_servicos_links IS
  'Links úteis (atalhos para sistemas/portais da empresa). Tabela GLOBAL, sem unit_id — todos os colaboradores veem os mesmos links. RLS via módulo RBAC central_servicos.';

-- ── 1b. GRANTS de tabela (papel authenticated do PostgREST) ──
-- Obrigatório: sem GRANT explícito, o PostgREST retorna
-- "permission denied for table" ANTES de avaliar a RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.central_servicos_links TO authenticated;

-- ── 2. TRIGGER updated_at (reutiliza update_updated_at()) ────
CREATE OR REPLACE TRIGGER trg_central_servicos_links_updated_at
  BEFORE UPDATE ON public.central_servicos_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- check_permission() é de 3 argumentos (user, module, action).
-- view inclui is_global_viewer() como rede de segurança (super_admin/diretor).
ALTER TABLE public.central_servicos_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_servicos_links: view"   ON public.central_servicos_links;
DROP POLICY IF EXISTS "central_servicos_links: create" ON public.central_servicos_links;
DROP POLICY IF EXISTS "central_servicos_links: edit"   ON public.central_servicos_links;
DROP POLICY IF EXISTS "central_servicos_links: delete" ON public.central_servicos_links;

CREATE POLICY "central_servicos_links: view" ON public.central_servicos_links
  FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'central_servicos', 'view'));

CREATE POLICY "central_servicos_links: create" ON public.central_servicos_links
  FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'central_servicos', 'create'));

CREATE POLICY "central_servicos_links: edit" ON public.central_servicos_links
  FOR UPDATE TO authenticated
  USING (check_permission(auth.uid(), 'central_servicos', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'central_servicos', 'edit'));

CREATE POLICY "central_servicos_links: delete" ON public.central_servicos_links
  FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'central_servicos', 'delete'));

-- ── 4. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
