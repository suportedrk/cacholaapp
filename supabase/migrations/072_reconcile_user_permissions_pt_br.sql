-- ============================================================
-- Migration 072 — Reconciliação user_permissions + role_default_perms
--                 EN → PT-BR + constraint CHECK → FK
-- PR 3 v1.5.6 — 27/abr/2026
-- ============================================================
--
-- CONTEXTO (drift de 071):
--   user_permissions.module e role_default_perms.module usam códigos EN (v001).
--   Catálogo modules (071) usa códigos PT-BR.
--   Esta migration reconcilia os dados e troca o CHECK por FK.
--
-- MAPEAMENTO COMPLETO (10 pares; 'checklists' é no-op — EN=PT-BR):
--   events        → eventos
--   maintenance   → manutencao
--   checklists    → checklists   (sem alteração de dados)
--   users         → usuarios
--   reports       → relatorios
--   audit_logs    → logs
--   notifications → notificacoes
--   settings      → configuracoes
--   providers     → prestadores  (+24 linhas em user_permissions)
--   minutes       → atas         (+16 linhas em user_permissions)
--
-- IMPACTO:
--   user_permissions:   ~N linhas renomeadas; FK adicionada
--   role_default_perms: ~M linhas renomeadas; FK adicionada
--   handle_new_user:    continua lendo role_default_perms (agora com codes PT-BR → OK)
--   TypeScript Module:  atualizado em Phase 3 do mesmo PR (permissions.ts)
-- ============================================================

BEGIN;

-- ============================================================
-- PRÉ-VERIFICAÇÃO — estado inicial para logging
-- ============================================================

DO $$
DECLARE
  cnt_up  INT;
  cnt_rdp INT;
BEGIN
  SELECT COUNT(*) INTO cnt_up  FROM public.user_permissions;
  SELECT COUNT(*) INTO cnt_rdp FROM public.role_default_perms;
  RAISE NOTICE 'Migration 072 iniciada: user_permissions=% linhas, role_default_perms=% linhas',
    cnt_up, cnt_rdp;
END;
$$;

-- ============================================================
-- FASE 1 — Renomear codes em user_permissions
-- ============================================================

UPDATE public.user_permissions SET module = 'eventos'       WHERE module = 'events';
UPDATE public.user_permissions SET module = 'manutencao'    WHERE module = 'maintenance';
-- 'checklists' permanece 'checklists' (code idêntico em EN e PT-BR — no-op intencional)
UPDATE public.user_permissions SET module = 'usuarios'      WHERE module = 'users';
UPDATE public.user_permissions SET module = 'relatorios'    WHERE module = 'reports';
UPDATE public.user_permissions SET module = 'logs'          WHERE module = 'audit_logs';
UPDATE public.user_permissions SET module = 'notificacoes'  WHERE module = 'notifications';
UPDATE public.user_permissions SET module = 'configuracoes' WHERE module = 'settings';
UPDATE public.user_permissions SET module = 'prestadores'   WHERE module = 'providers';
UPDATE public.user_permissions SET module = 'atas'          WHERE module = 'minutes';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.user_permissions WHERE module IN (
    'events','maintenance','users','reports','audit_logs',
    'notifications','settings','providers','minutes'
  );
  IF cnt > 0 THEN
    RAISE EXCEPTION 'user_permissions ainda tem % linhas com codes EN após UPDATE', cnt;
  END IF;
  RAISE NOTICE 'Fase 1 OK: user_permissions sem codes EN residuais';
END;
$$;

-- ============================================================
-- FASE 2 — Renomear codes em role_default_perms
-- ============================================================

UPDATE public.role_default_perms SET module = 'eventos'       WHERE module = 'events';
UPDATE public.role_default_perms SET module = 'manutencao'    WHERE module = 'maintenance';
-- 'checklists' permanece 'checklists' (no-op intencional)
UPDATE public.role_default_perms SET module = 'usuarios'      WHERE module = 'users';
UPDATE public.role_default_perms SET module = 'relatorios'    WHERE module = 'reports';
UPDATE public.role_default_perms SET module = 'logs'          WHERE module = 'audit_logs';
UPDATE public.role_default_perms SET module = 'notificacoes'  WHERE module = 'notifications';
UPDATE public.role_default_perms SET module = 'configuracoes' WHERE module = 'settings';
UPDATE public.role_default_perms SET module = 'prestadores'   WHERE module = 'providers';
UPDATE public.role_default_perms SET module = 'atas'          WHERE module = 'minutes';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.role_default_perms WHERE module IN (
    'events','maintenance','users','reports','audit_logs',
    'notifications','settings','providers','minutes'
  );
  IF cnt > 0 THEN
    RAISE EXCEPTION 'role_default_perms ainda tem % linhas com codes EN após UPDATE', cnt;
  END IF;
  RAISE NOTICE 'Fase 2 OK: role_default_perms sem codes EN residuais';
END;
$$;

-- ============================================================
-- FASE 3 — Substituir CHECK por FK em user_permissions
-- ============================================================

-- Remove a constraint CHECK legada (pode ter sido ADD/DROPPED em migrations anteriores)
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_module_check;

-- Adiciona FK → modules(code). ON UPDATE CASCADE propaga renomeações futuras de module.code.
-- ON DELETE CASCADE remove permissões do usuário se o módulo for desativado/excluído.
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_module_fk
  FOREIGN KEY (module) REFERENCES public.modules(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ============================================================
-- FASE 4 — Substituir CHECK por FK em role_default_perms
-- ============================================================

ALTER TABLE public.role_default_perms
  DROP CONSTRAINT IF EXISTS role_default_perms_module_check;

ALTER TABLE public.role_default_perms
  ADD CONSTRAINT role_default_perms_module_fk
  FOREIGN KEY (module) REFERENCES public.modules(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ============================================================
-- FASE 5 — Verificação pós-migração (orphans esperados = 0)
-- ============================================================

DO $$
DECLARE
  orphan_up  INT;
  orphan_rdp INT;
  cnt_up     INT;
  cnt_rdp    INT;
BEGIN
  SELECT COUNT(*) INTO orphan_up
  FROM public.user_permissions up
  WHERE NOT EXISTS (SELECT 1 FROM public.modules m WHERE m.code = up.module);

  SELECT COUNT(*) INTO orphan_rdp
  FROM public.role_default_perms rdp
  WHERE NOT EXISTS (SELECT 1 FROM public.modules m WHERE m.code = rdp.module);

  IF orphan_up > 0 OR orphan_rdp > 0 THEN
    RAISE EXCEPTION
      'ABORTANDO: orphan codes detectados — user_permissions=%, role_default_perms=%',
      orphan_up, orphan_rdp;
  END IF;

  SELECT COUNT(*) INTO cnt_up  FROM public.user_permissions;
  SELECT COUNT(*) INTO cnt_rdp FROM public.role_default_perms;
  RAISE NOTICE 'Migration 072 CONCLUÍDA: 0 orphans. user_permissions=% linhas, role_default_perms=% linhas',
    cnt_up, cnt_rdp;
END;
$$;

COMMIT;
