-- =============================================================================
-- Migration 073 — Reconciliação user_permissions + role_default_perms EN→PT-BR
--                 Substitui migration 072 (que tinha ordem incorreta de DDL)
-- Hotfix v1.5.7 — 27/abr/2026
-- =============================================================================
--
-- CONTEXTO:
--   user_permissions.module e role_default_perms.module usam codes EN (legado v001).
--   Catálogo modules (migration 071) usa codes PT-BR.
--   Esta migration reconcilia os dados nas duas tabelas e substitui os CHECK
--   constraints por FK → modules(code), que se auto-atualiza via ON UPDATE CASCADE.
--
-- ORDEM CORRETA (diferente da 072 deprecated):
--   1. DROP CHECK constraints (primeiro — libera os UPDATEs)
--   2. UPDATE module codes EN→PT-BR (segundo — agora sem restrição)
--   3. Validação de orphans (terceiro — aborta se sobrar code inválido)
--   4. ADD FK constraints (quarto — reaplica restrição agora correta)
--
-- IDEMPOTÊNCIA:
--   UPDATEs são no-op se codes já estiverem PT-BR (WHERE module IN (...) não bate).
--   DROP CONSTRAINT IF EXISTS não falha se já dropado.
--   ADD CONSTRAINT via bloco DO captura duplicate_object e emite NOTICE.
--   Pode ser executada múltiplas vezes sem efeito colateral.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- PASSO 1 — Diagnóstico inicial
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Migration 073 iniciada ===';
  RAISE NOTICE 'user_permissions por module (estado inicial):';
  FOR rec IN
    SELECT module, COUNT(*) AS cnt FROM public.user_permissions GROUP BY module ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  % = %', rec.module, rec.cnt;
  END LOOP;

  RAISE NOTICE 'role_default_perms por module (estado inicial):';
  FOR rec IN
    SELECT module, COUNT(*) AS cnt FROM public.role_default_perms GROUP BY module ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  % = %', rec.module, rec.cnt;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- PASSO 2 — DROP das CHECK constraints (libera UPDATEs)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_module_check;

ALTER TABLE public.role_default_perms
  DROP CONSTRAINT IF EXISTS role_default_perms_module_check;

-- ─────────────────────────────────────────────────────────────
-- PASSO 3 — UPDATEs EN→PT-BR
--   'checklists' não muda (code já é igual em EN e PT-BR)
-- ─────────────────────────────────────────────────────────────
UPDATE public.user_permissions
SET module = CASE module
  WHEN 'events'        THEN 'eventos'
  WHEN 'maintenance'   THEN 'manutencao'
  WHEN 'users'         THEN 'usuarios'
  WHEN 'reports'       THEN 'relatorios'
  WHEN 'audit_logs'    THEN 'logs'
  WHEN 'notifications' THEN 'notificacoes'
  WHEN 'settings'      THEN 'configuracoes'
  WHEN 'providers'     THEN 'prestadores'
  WHEN 'minutes'       THEN 'atas'
  ELSE module
END
WHERE module IN (
  'events','maintenance','users','reports',
  'audit_logs','notifications','settings','providers','minutes'
);

UPDATE public.role_default_perms
SET module = CASE module
  WHEN 'events'        THEN 'eventos'
  WHEN 'maintenance'   THEN 'manutencao'
  WHEN 'users'         THEN 'usuarios'
  WHEN 'reports'       THEN 'relatorios'
  WHEN 'audit_logs'    THEN 'logs'
  WHEN 'notifications' THEN 'notificacoes'
  WHEN 'settings'      THEN 'configuracoes'
  WHEN 'providers'     THEN 'prestadores'
  WHEN 'minutes'       THEN 'atas'
  ELSE module
END
WHERE module IN (
  'events','maintenance','users','reports',
  'audit_logs','notifications','settings','providers','minutes'
);

-- ─────────────────────────────────────────────────────────────
-- PASSO 4 — Validar: nenhum code EN órfão deve restar
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  orphan_up  INTEGER;
  orphan_rdp INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_up
  FROM public.user_permissions
  WHERE module NOT IN (SELECT code FROM public.modules);

  IF orphan_up > 0 THEN
    RAISE EXCEPTION
      'Aborting: % linhas em user_permissions com module code não presente em modules. Verificar manualmente.',
      orphan_up;
  END IF;

  SELECT COUNT(*) INTO orphan_rdp
  FROM public.role_default_perms
  WHERE module NOT IN (SELECT code FROM public.modules);

  IF orphan_rdp > 0 THEN
    RAISE EXCEPTION
      'Aborting: % linhas em role_default_perms com module code não presente em modules. Verificar manualmente.',
      orphan_rdp;
  END IF;

  RAISE NOTICE 'Validação OK: zero orphans em user_permissions e role_default_perms';
END $$;

-- ─────────────────────────────────────────────────────────────
-- PASSO 5 — ADD FK constraints (idempotente via bloco DO)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.user_permissions
    ADD CONSTRAINT user_permissions_module_fk
    FOREIGN KEY (module)
    REFERENCES public.modules(code)
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  RAISE NOTICE 'FK user_permissions_module_fk adicionada';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'FK user_permissions_module_fk já existe — OK';
END $$;

DO $$
BEGIN
  ALTER TABLE public.role_default_perms
    ADD CONSTRAINT role_default_perms_module_fk
    FOREIGN KEY (module)
    REFERENCES public.modules(code)
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  RAISE NOTICE 'FK role_default_perms_module_fk adicionada';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'FK role_default_perms_module_fk já existe — OK';
END $$;

-- ─────────────────────────────────────────────────────────────
-- PASSO 6 — Diagnóstico final
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Migration 073 concluída ===';
  RAISE NOTICE 'user_permissions por module (estado final):';
  FOR rec IN
    SELECT module, COUNT(*) AS cnt FROM public.user_permissions GROUP BY module ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  % = %', rec.module, rec.cnt;
  END LOOP;

  RAISE NOTICE 'role_default_perms por module (estado final):';
  FOR rec IN
    SELECT module, COUNT(*) AS cnt FROM public.role_default_perms GROUP BY module ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  % = %', rec.module, rec.cnt;
  END LOOP;
END $$;

COMMIT;
