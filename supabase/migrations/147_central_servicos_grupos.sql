-- ============================================================
-- Migration 147 — Central de Serviços: Grupos na Agenda (Bloco C2)
-- Adiciona o tipo 'grupo' aos contatos e a tabela de membros do grupo
-- ("quem recebe"). Reaproveita o módulo RBAC central_servicos — sem módulo novo.
--
-- Módulo GLOBAL: sem unit_id, sem filtro por unidade.
--
-- Regra: um grupo (tipo='grupo') tem membros que são apenas PESSOAS
-- (tipo='pessoa'). Sem grupos aninhados. Validado por trigger + API.
--
-- RLS de tabela filha (membros): adicionar/remover membro = EDITAR o grupo
-- (edit), não create/delete. SELECT de membros respeita a visibilidade do
-- grupo pai: membros de grupo inativo não vazam para quem só tem view.
--
-- Rollback: 147_central_servicos_grupos_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. tipo do contato (pessoa | grupo) ──────────────────────
ALTER TABLE public.central_servicos_contatos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'pessoa'
  CHECK (tipo IN ('pessoa', 'grupo'));

COMMENT ON COLUMN public.central_servicos_contatos.tipo IS
  'pessoa (contato individual) ou grupo (lista de distribuição cujos membros são pessoas).';

-- ── 2. TABELA DE MEMBROS (quem recebe) ───────────────────────
CREATE TABLE IF NOT EXISTS public.central_servicos_grupo_membros (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id   uuid        NOT NULL REFERENCES public.central_servicos_contatos(id) ON DELETE CASCADE,
  membro_id  uuid        NOT NULL REFERENCES public.central_servicos_contatos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (grupo_id, membro_id)
);

CREATE INDEX IF NOT EXISTS idx_csg_membros_grupo  ON public.central_servicos_grupo_membros (grupo_id);
CREATE INDEX IF NOT EXISTS idx_csg_membros_membro ON public.central_servicos_grupo_membros (membro_id);

COMMENT ON TABLE public.central_servicos_grupo_membros IS
  'Membros de um grupo da agenda ("quem recebe"). grupo_id → contato tipo grupo; membro_id → contato tipo pessoa. Validado por trg_validate_grupo_membro.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.central_servicos_grupo_membros TO authenticated;

-- ── 3. TRIGGER de validação (grupo×pessoa, sem aninhamento) ──
CREATE OR REPLACE FUNCTION public.validate_grupo_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                -- integridade independe da RLS de visibilidade
SET search_path = public
AS $$
DECLARE
  g_tipo text;
  m_tipo text;
BEGIN
  IF NEW.grupo_id = NEW.membro_id THEN
    RAISE EXCEPTION 'Um grupo não pode ser membro de si mesmo.';
  END IF;

  SELECT tipo INTO g_tipo FROM public.central_servicos_contatos WHERE id = NEW.grupo_id;
  SELECT tipo INTO m_tipo FROM public.central_servicos_contatos WHERE id = NEW.membro_id;

  IF g_tipo IS DISTINCT FROM 'grupo' THEN
    RAISE EXCEPTION 'grupo_id deve referenciar um contato do tipo grupo (atual: %).', COALESCE(g_tipo, 'inexistente');
  END IF;
  IF m_tipo IS DISTINCT FROM 'pessoa' THEN
    RAISE EXCEPTION 'membro_id deve referenciar um contato do tipo pessoa (atual: %).', COALESCE(m_tipo, 'inexistente');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_grupo_membro ON public.central_servicos_grupo_membros;
CREATE TRIGGER trg_validate_grupo_membro
  BEFORE INSERT OR UPDATE ON public.central_servicos_grupo_membros
  FOR EACH ROW EXECUTE FUNCTION public.validate_grupo_membro();

-- ── 4. RLS da tabela de membros ──────────────────────────────
ALTER TABLE public.central_servicos_grupo_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "csg_membros: view"   ON public.central_servicos_grupo_membros;
DROP POLICY IF EXISTS "csg_membros: insert" ON public.central_servicos_grupo_membros;
DROP POLICY IF EXISTS "csg_membros: delete" ON public.central_servicos_grupo_membros;

-- view: precisa de central_servicos.view E o grupo pai estar visível
-- (ativo, ou o usuário tem edit) → membros de grupo inativo não vazam p/ view-only.
CREATE POLICY "csg_membros: view" ON public.central_servicos_grupo_membros
  FOR SELECT TO authenticated
  USING (
    public.check_permission(auth.uid(), 'central_servicos', 'view')
    AND EXISTS (
      SELECT 1 FROM public.central_servicos_contatos g
      WHERE g.id = grupo_id
        AND (g.ativo = true OR public.check_permission(auth.uid(), 'central_servicos', 'edit'))
    )
  );

-- adicionar/remover membro = EDITAR o grupo (regra de tabela filha do projeto)
CREATE POLICY "csg_membros: insert" ON public.central_servicos_grupo_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.check_permission(auth.uid(), 'central_servicos', 'edit'));

CREATE POLICY "csg_membros: delete" ON public.central_servicos_grupo_membros
  FOR DELETE TO authenticated
  USING (public.check_permission(auth.uid(), 'central_servicos', 'edit'));

-- ── 5. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
