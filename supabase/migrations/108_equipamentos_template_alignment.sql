-- ============================================================
-- Migration 108 — Equipamentos: alinhamento de template (Fase 2 piloto)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md Fase 1 (Item 6)
--             + decisão "Opção B" do dono (2026-05-26) para preservar o
--             acesso atual do cargo manutencao ao módulo equipamentos.
--
-- Contexto: hoje a RLS de public.equipment e public.equipment_categories
-- filtra somente por unidade (não chama check_permission). O layout
-- /equipamentos usa MAINTENANCE_MODULE_ROLES (super_admin, diretor,
-- gerente, manutencao). Resultado: esses 4 cargos podem view/create/edit/
-- delete equipamentos dentro da sua unidade. O seed atual de
-- role_permissions só dá create/edit/delete para super_admin/diretor/
-- gerente, deixando manutencao com somente view — divergência.
--
-- Esta migration é a primeira de TRÊS que migram equipamentos para o
-- molde de ouro de forma INVISÍVEL em runtime:
--   108 — template alignment   (esta migration)
--   109 — user_permissions backfill aditivo
--   110 — RLS golden pattern (troca de fato)
--
-- ESCOPO ÚNICO desta migration: alinhar role_permissions para
-- manutencao ganhar create/edit/delete em equipamentos, refletindo o
-- acesso REAL que esse cargo já tem hoje via RLS antiga. NÃO toca em
-- RLS, NÃO toca em user_permissions, NÃO muda código de aplicação.
--
-- Não-destrutivo: idempotente (ON CONFLICT DO UPDATE).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo permission_controls precisa ter as ações
-- de equipamentos (devem existir desde 107).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.permission_controls
  WHERE module_code = 'equipamentos'
    AND code IN ('view','create','edit','delete')
    AND kind = 'action';

  IF v_count <> 4 THEN
    RAISE EXCEPTION
      'Abortando: esperava 4 ações em permission_controls para equipamentos, encontrei %. Migration 107 (permission_controls catalog) precisa estar aplicada antes desta.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Concede ao cargo manutencao create/edit/delete em equipamentos.
-- ON CONFLICT DO UPDATE: idempotente. Sobrescrever para granted=true
-- é o comportamento desejado aqui — o template é declarativo.
-- ------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('manutencao', 'equipamentos', 'create', true),
  ('manutencao', 'equipamentos', 'edit',   true),
  ('manutencao', 'equipamentos', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE
  SET granted = EXCLUDED.granted,
      updated_at = now();

-- ------------------------------------------------------------
-- Validação pós-condição: 4 linhas granted=true para manutencao em equipamentos
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.role_permissions
  WHERE role_code = 'manutencao'
    AND module_code = 'equipamentos'
    AND action IN ('view','create','edit','delete')
    AND granted = true;

  IF v_count <> 4 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: esperava 4 linhas granted=true para manutencao em equipamentos, encontrei %.',
      v_count;
  END IF;

  RAISE NOTICE 'OK: manutencao agora tem view/create/edit/delete granted=true em equipamentos no template.';
END
$$;

-- Reload PostgREST schema cache (cosmético — sem mudança de schema)
NOTIFY pgrst, 'reload schema';

COMMIT;
