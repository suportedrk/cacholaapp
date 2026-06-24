-- ============================================================
-- Migration 164 — Central de Serviços Fase 2 (Bloco E.2): Confirmação de leitura
-- O autor pode marcar um aviso como "exige confirmação"; cada usuário confirma
-- a própria leitura ("Confirmo que li"). Gestores (edit) veem quem confirmou.
-- Reaproveita o módulo RBAC central_servicos — sem módulo novo.
--
-- Convenção da esteira (migrations 160+): SEM BEGIN/COMMIT e SEM NOTIFY pgrst.
--
-- Rollback: 164_central_servicos_avisos_leitura_rollback.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PARTE 1 — FLAG "exige confirmação" no aviso
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.central_servicos_avisos
  ADD COLUMN IF NOT EXISTS exige_confirmacao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.central_servicos_avisos.exige_confirmacao IS
  'Quando true, o aviso pede confirmação de leitura ("Confirmo que li") aos usuários.';

-- ════════════════════════════════════════════════════════════
-- PARTE 2 — TABELA DE CONFIRMAÇÕES DE LEITURA
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.central_servicos_avisos_leitura (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id      uuid        NOT NULL REFERENCES public.central_servicos_avisos(id) ON DELETE CASCADE,
  usuario_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  confirmado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_central_servicos_avisos_leitura_aviso
  ON public.central_servicos_avisos_leitura (aviso_id);

COMMENT ON TABLE public.central_servicos_avisos_leitura IS
  'Confirmações de leitura do Mural de Avisos. Cada (aviso, usuário) confirma uma vez. RLS: o usuário vê/cria/apaga a própria; gestor (edit) vê todas.';

GRANT SELECT, INSERT, DELETE ON public.central_servicos_avisos_leitura TO authenticated;

-- ── RLS ──────────────────────────────────────────────────────
-- select: a própria confirmação OU gestor (edit) vê todas (para a taxa).
-- insert/delete: somente a própria (usuario_id = auth.uid()), exige view no módulo.
ALTER TABLE public.central_servicos_avisos_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_servicos_avisos_leitura: view"   ON public.central_servicos_avisos_leitura;
DROP POLICY IF EXISTS "central_servicos_avisos_leitura: insert" ON public.central_servicos_avisos_leitura;
DROP POLICY IF EXISTS "central_servicos_avisos_leitura: delete" ON public.central_servicos_avisos_leitura;

CREATE POLICY "central_servicos_avisos_leitura: view" ON public.central_servicos_avisos_leitura
  FOR SELECT TO authenticated
  USING (
    public.check_permission(auth.uid(), 'central_servicos', 'view')
    AND (
      usuario_id = auth.uid()
      OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
    )
  );

CREATE POLICY "central_servicos_avisos_leitura: insert" ON public.central_servicos_avisos_leitura
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND public.check_permission(auth.uid(), 'central_servicos', 'view')
  );

CREATE POLICY "central_servicos_avisos_leitura: delete" ON public.central_servicos_avisos_leitura
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());
