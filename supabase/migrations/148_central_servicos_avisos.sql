-- ============================================================
-- Migration 148 — Central de Serviços: Mural de Avisos (Bloco D)
--                + guard da troca de tipo de contato (pendência do C2).
-- Reaproveita o módulo RBAC central_servicos — sem módulo novo.
--
-- Módulo GLOBAL: sem unit_id, sem filtro por unidade. A coluna `unidade` é
-- apenas um RÓTULO informativo (geral/pinheiros/moema), nunca trava de segurança.
--
-- Rollback: 148_central_servicos_avisos_rollback.sql
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- PARTE 1 — MURAL DE AVISOS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.central_servicos_avisos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text        NOT NULL,
  conteudo     text        NOT NULL,
  categoria    text        NOT NULL
               CHECK (categoria IN ('informativo', 'manutencao', 'ti', 'rh', 'operacional', 'eventos')),
  prioridade   text        NOT NULL DEFAULT 'normal'
               CHECK (prioridade IN ('normal', 'alta')),
  unidade      text        NOT NULL DEFAULT 'geral'
               CHECK (unidade IN ('geral', 'pinheiros', 'moema')),       -- rótulo informativo
  publicado_em timestamptz NOT NULL DEFAULT now(),
  expira_em    timestamptz,                                              -- NULL = nunca expira
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

-- Índice para a janela de vigência (filtro da RLS) e ordenação.
CREATE INDEX IF NOT EXISTS idx_central_servicos_avisos_vigencia
  ON public.central_servicos_avisos (publicado_em DESC, expira_em);

COMMENT ON TABLE public.central_servicos_avisos IS
  'Mural de avisos internos. Tabela GLOBAL, sem unit_id. RLS via módulo central_servicos: quem só tem view vê apenas avisos vigentes; edit vê todos. unidade é rótulo informativo.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.central_servicos_avisos TO authenticated;

CREATE OR REPLACE TRIGGER trg_central_servicos_avisos_updated_at
  BEFORE UPDATE ON public.central_servicos_avisos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── RLS REFORÇADA ────────────────────────────────────────────
-- view → vê só avisos VIGENTES (publicado e não expirado);
-- edit → vê todos (futuros/expirados) para gerenciar. A restrição vive aqui.
ALTER TABLE public.central_servicos_avisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_servicos_avisos: view"   ON public.central_servicos_avisos;
DROP POLICY IF EXISTS "central_servicos_avisos: create" ON public.central_servicos_avisos;
DROP POLICY IF EXISTS "central_servicos_avisos: edit"   ON public.central_servicos_avisos;
DROP POLICY IF EXISTS "central_servicos_avisos: delete" ON public.central_servicos_avisos;

CREATE POLICY "central_servicos_avisos: view" ON public.central_servicos_avisos
  FOR SELECT TO authenticated
  USING (
    public.check_permission(auth.uid(), 'central_servicos', 'view')
    AND (
      public.check_permission(auth.uid(), 'central_servicos', 'edit')
      OR (publicado_em <= now() AND (expira_em IS NULL OR expira_em > now()))
    )
  );

CREATE POLICY "central_servicos_avisos: create" ON public.central_servicos_avisos
  FOR INSERT TO authenticated
  WITH CHECK (public.check_permission(auth.uid(), 'central_servicos', 'create'));

CREATE POLICY "central_servicos_avisos: edit" ON public.central_servicos_avisos
  FOR UPDATE TO authenticated
  USING (public.check_permission(auth.uid(), 'central_servicos', 'edit'))
  WITH CHECK (public.check_permission(auth.uid(), 'central_servicos', 'edit'));

CREATE POLICY "central_servicos_avisos: delete" ON public.central_servicos_avisos
  FOR DELETE TO authenticated
  USING (public.check_permission(auth.uid(), 'central_servicos', 'delete'));

-- ════════════════════════════════════════════════════════════
-- PARTE 2 — GUARD DA TROCA DE TIPO DE CONTATO (pendência C2)
-- ════════════════════════════════════════════════════════════
-- Impede quebrar a invariante grupo×pessoa: não deixa mudar `tipo` de um
-- contato que tem vínculos (grupo com membros, ou pessoa que é membro de
-- algum grupo). É preciso limpar os vínculos antes.

CREATE OR REPLACE FUNCTION public.validate_contato_tipo_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    -- grupo com membros?
    IF EXISTS (SELECT 1 FROM public.central_servicos_grupo_membros WHERE grupo_id = OLD.id) THEN
      RAISE EXCEPTION 'Este grupo tem membros. Remova os vínculos antes de mudar o tipo.';
    END IF;
    -- pessoa que é membro de algum grupo?
    IF EXISTS (SELECT 1 FROM public.central_servicos_grupo_membros WHERE membro_id = OLD.id) THEN
      RAISE EXCEPTION 'Este contato é membro de um grupo. Remova os vínculos antes de mudar o tipo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contato_tipo_change ON public.central_servicos_contatos;
CREATE TRIGGER trg_validate_contato_tipo_change
  BEFORE UPDATE OF tipo ON public.central_servicos_contatos
  FOR EACH ROW EXECUTE FUNCTION public.validate_contato_tipo_change();

-- ── Recarregar schema do PostgREST ───────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
