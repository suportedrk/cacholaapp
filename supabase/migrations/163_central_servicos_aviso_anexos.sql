-- ============================================================
-- Migration 163 — Central de Serviços Fase 2 (Bloco E.1): Anexos do Mural de Avisos
-- Permite anexar arquivos (PDF/imagem) a um aviso. Reaproveita o módulo RBAC
-- central_servicos — sem módulo novo.
--
-- Módulo GLOBAL: sem unit_id, sem filtro por unidade.
--
-- Convenção da esteira (migrations 160+): SEM BEGIN/COMMIT e SEM NOTIFY pgrst
-- soltos — a esteira migrate-prod.yml cuida da transação e do reload do schema.
--
-- Rollback: 163_central_servicos_aviso_anexos_rollback.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PARTE 1 — TABELA DE ANEXOS (metadata; o binário vive no Storage)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.central_servicos_aviso_anexos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id     uuid        NOT NULL REFERENCES public.central_servicos_avisos(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  file_name    text        NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_central_servicos_aviso_anexos_aviso
  ON public.central_servicos_aviso_anexos (aviso_id);

COMMENT ON TABLE public.central_servicos_aviso_anexos IS
  'Anexos (PDF/imagem) do Mural de Avisos. Metadata; o binário fica no bucket central-servicos-avisos-anexos. RLS via módulo central_servicos; a visibilidade espelha a vigência do aviso pai.';

GRANT SELECT, INSERT, DELETE ON public.central_servicos_aviso_anexos TO authenticated;

-- ── RLS — espelha a regra de vigência do aviso pai ───────────
-- view: vê anexo só de aviso que ele já enxerga (edit vê todos; senão só vigente).
-- insert: create OR edit. delete: delete OR edit.
ALTER TABLE public.central_servicos_aviso_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_servicos_aviso_anexos: view"   ON public.central_servicos_aviso_anexos;
DROP POLICY IF EXISTS "central_servicos_aviso_anexos: insert" ON public.central_servicos_aviso_anexos;
DROP POLICY IF EXISTS "central_servicos_aviso_anexos: delete" ON public.central_servicos_aviso_anexos;

CREATE POLICY "central_servicos_aviso_anexos: view" ON public.central_servicos_aviso_anexos
  FOR SELECT TO authenticated
  USING (
    public.check_permission(auth.uid(), 'central_servicos', 'view')
    AND EXISTS (
      SELECT 1 FROM public.central_servicos_avisos a
      WHERE a.id = central_servicos_aviso_anexos.aviso_id
        AND (
          public.check_permission(auth.uid(), 'central_servicos', 'edit')
          OR (a.publicado_em <= now() AND (a.expira_em IS NULL OR a.expira_em > now()))
        )
    )
  );

CREATE POLICY "central_servicos_aviso_anexos: insert" ON public.central_servicos_aviso_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_permission(auth.uid(), 'central_servicos', 'create')
    OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
  );

CREATE POLICY "central_servicos_aviso_anexos: delete" ON public.central_servicos_aviso_anexos
  FOR DELETE TO authenticated
  USING (
    public.check_permission(auth.uid(), 'central_servicos', 'delete')
    OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
  );

-- ════════════════════════════════════════════════════════════
-- PARTE 2 — BUCKET PRIVADO DOS ANEXOS
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'central-servicos-avisos-anexos',
  'central-servicos-avisos-anexos',
  false,                                              -- PRIVADO (signed URL)
  10485760,                                           -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS DO STORAGE (gateada por check_permission) ────────────
-- Leitura: central_servicos.view (signed URL exige passar nesta policy).
-- Upload: create/edit. Remoção: delete/edit. Espelha o bucket de contatos (mig 146).
DROP POLICY IF EXISTS "central-servicos-avisos-anexos: select" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-avisos-anexos: insert" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-avisos-anexos: delete" ON storage.objects;

CREATE POLICY "central-servicos-avisos-anexos: select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'central-servicos-avisos-anexos'
    AND public.check_permission(auth.uid(), 'central_servicos', 'view')
  );

CREATE POLICY "central-servicos-avisos-anexos: insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'central-servicos-avisos-anexos'
    AND (
      public.check_permission(auth.uid(), 'central_servicos', 'create')
      OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
    )
  );

CREATE POLICY "central-servicos-avisos-anexos: delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'central-servicos-avisos-anexos'
    AND (
      public.check_permission(auth.uid(), 'central_servicos', 'delete')
      OR public.check_permission(auth.uid(), 'central_servicos', 'edit')
    )
  );
