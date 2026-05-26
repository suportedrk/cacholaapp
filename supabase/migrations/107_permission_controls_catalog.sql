-- ============================================================
-- Migration 107 — permission_controls catalog (Fase 1 / Fundação)
-- Criado em: 2026-05-25
-- Referência de design: docs/rbac/proposta-arquitetura-alvo.md (Item 1, Opção A)
--
-- Objetivo desta fase: PREPARAÇÃO / FUNDAÇÃO — não-destrutiva.
-- Nenhum comportamento de acesso muda em runtime. Esta migration:
--   1. Cria public.permission_controls como catálogo único para
--      permissões grossas (módulo × ação) e finas (controles nomeados).
--   2. Semeia as 5 ações canônicas (view/create/edit/delete/export)
--      para os 21 módulos atuais como kind='action'. 105 linhas.
--   3. Substitui o CHECK constraint estreito de user_permissions.action
--      e role_permissions.action por FK composta apontando para o catálogo.
--   4. NÃO toca em RLS, RPC ou check_permission(). NÃO adiciona unit_id
--      ao motor de permissão (Q2 adiada por decisão de produto).
--   5. NÃO remove hasRole nem requireRoleServer (Q3 mantida).
--
-- Estado pré-migration verificado:
--   • public.modules tem 21 codes (decoracao já presente via 097).
--   • Module type em src/types/permissions.ts já tem 21 codes alinhados.
--   • role_permissions/user_permissions já têm FK para modules(code).
--   • CHECK constraint estreito em .action presente em ambas as tabelas.
--
-- IDEMPOTÊNCIA: a migration é totalmente idempotente — pode rodar
-- múltiplas vezes sem efeito colateral (CREATE IF NOT EXISTS,
-- ON CONFLICT DO UPDATE, DROP CONSTRAINT IF EXISTS, IF NOT EXISTS em FK).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tabela de catálogo permission_controls
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_controls (
  module_code  TEXT        NOT NULL REFERENCES public.modules(code) ON UPDATE CASCADE ON DELETE CASCADE,
  code         TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  description  TEXT,
  kind         TEXT        NOT NULL CHECK (kind IN ('action','control')),
  sort_order   INT         NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (module_code, code)
);

COMMENT ON TABLE public.permission_controls IS
  'Catálogo único de permissões. kind=action: 5 ações canônicas (view/create/edit/delete/export) por módulo. '
  'kind=control: controles finos nomeados (PT-BR snake_case, ex: anexos_excluir, valor_festa_ver). '
  'FK de user_permissions.(module,action) e role_permissions.(module_code,action) aponta para (module_code, code). '
  'Proposta: docs/rbac/proposta-arquitetura-alvo.md Item 1 Opção A.';

COMMENT ON COLUMN public.permission_controls.code IS
  'Identificador da permissão dentro do módulo. Para kind=action vale view/create/edit/delete/export. '
  'Para kind=control deve ser PT-BR snake_case (ex: anexos_excluir).';

COMMENT ON COLUMN public.permission_controls.kind IS
  'action = 5 ações canônicas (sempre presentes em todo módulo). control = controle fino curado.';

-- Trigger updated_at (reutiliza a função existente do projeto)
DROP TRIGGER IF EXISTS trg_permission_controls_updated_at ON public.permission_controls;
CREATE TRIGGER trg_permission_controls_updated_at
  BEFORE UPDATE ON public.permission_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 2. RLS — leitura aberta para autenticados; escrita só service_role
--    Mesmo padrão usado em public.modules / public.roles / public.role_permissions
--    (migration 071). UI de gestão de catálogo entra em fase futura.
-- ------------------------------------------------------------
ALTER TABLE public.permission_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permission_controls_select_authenticated" ON public.permission_controls;
CREATE POLICY "permission_controls_select_authenticated"
  ON public.permission_controls FOR SELECT
  TO authenticated
  USING (true);

-- Sem policy de escrita: INSERT/UPDATE/DELETE só via service_role (bypass RLS).

-- ------------------------------------------------------------
-- 3. Seed das 5 ações canônicas para todos os 21 módulos
--    CROSS JOIN garante cobertura mesmo se novos módulos forem adicionados
--    em migrations futuras (este seed é re-executável e converge).
-- ------------------------------------------------------------
INSERT INTO public.permission_controls (module_code, code, label, description, kind, sort_order)
SELECT
  m.code AS module_code,
  a.code AS code,
  a.label,
  a.description,
  'action' AS kind,
  a.sort_order
FROM public.modules m
CROSS JOIN (
  VALUES
    ('view',   'Visualizar', 'Acesso de leitura ao módulo.',                    10),
    ('create', 'Criar',      'Criação de novos registros no módulo.',           20),
    ('edit',   'Editar',     'Edição de registros existentes no módulo.',       30),
    ('delete', 'Excluir',    'Exclusão de registros do módulo.',                40),
    ('export', 'Exportar',   'Exportação de dados do módulo (CSV/Excel/PDF).',  50)
) AS a(code, label, description, sort_order)
ON CONFLICT (module_code, code) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  kind        = EXCLUDED.kind,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();

-- ------------------------------------------------------------
-- 4. Substituir CHECK estreito por FK composta para o catálogo
--    Estratégia: adicionar FK primeiro (NOT VALID seria opção, mas como
--    o seed acima cobre todos os (módulo, ação) já em uso, validação
--    in-place é segura). Depois dropar o CHECK.
--
--    Como verificação preventiva, qualquer linha em
--    user_permissions/role_permissions que apontar para par (módulo, ação)
--    ausente do catálogo aborta a migration via RAISE EXCEPTION abaixo.
-- ------------------------------------------------------------

-- 4.1 Pré-validação: orphan rows
DO $$
DECLARE
  v_orphan_up INT;
  v_orphan_rp INT;
BEGIN
  SELECT COUNT(*) INTO v_orphan_up
  FROM public.user_permissions up
  WHERE NOT EXISTS (
    SELECT 1 FROM public.permission_controls pc
    WHERE pc.module_code = up.module AND pc.code = up.action
  );

  SELECT COUNT(*) INTO v_orphan_rp
  FROM public.role_permissions rp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.permission_controls pc
    WHERE pc.module_code = rp.module_code AND pc.code = rp.action
  );

  IF v_orphan_up > 0 OR v_orphan_rp > 0 THEN
    RAISE EXCEPTION
      'Abortando: encontrei % linhas em user_permissions e % em role_permissions sem par correspondente em permission_controls. Investigar manualmente.',
      v_orphan_up, v_orphan_rp;
  END IF;

  RAISE NOTICE 'Validação OK: zero orphans em user_permissions e role_permissions.';
END
$$;

-- 4.2 FK composta em user_permissions(module, action)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_permissions_module_action_fk'
      AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions
      ADD CONSTRAINT user_permissions_module_action_fk
      FOREIGN KEY (module, action)
      REFERENCES public.permission_controls (module_code, code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    RAISE NOTICE 'FK user_permissions_module_action_fk adicionada.';
  ELSE
    RAISE NOTICE 'FK user_permissions_module_action_fk já existe — pulando.';
  END IF;
END
$$;

-- 4.3 FK composta em role_permissions(module_code, action)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_module_action_fk'
      AND conrelid = 'public.role_permissions'::regclass
  ) THEN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_module_action_fk
      FOREIGN KEY (module_code, action)
      REFERENCES public.permission_controls (module_code, code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    RAISE NOTICE 'FK role_permissions_module_action_fk adicionada.';
  ELSE
    RAISE NOTICE 'FK role_permissions_module_action_fk já existe — pulando.';
  END IF;
END
$$;

-- 4.4 Remover CHECK constraints estreitos (catálogo passa a ser a fonte de verdade)
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_action_check;

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_action_check;

-- ------------------------------------------------------------
-- 5. Índice de apoio (sort_order para UI de admin futura)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_permission_controls_module_sort
  ON public.permission_controls (module_code, kind, sort_order);

-- ------------------------------------------------------------
-- 6. Relatório de pós-condição
-- ------------------------------------------------------------
DO $$
DECLARE
  v_total   INT;
  v_actions INT;
  v_ctrls   INT;
  v_modules INT;
BEGIN
  SELECT COUNT(*) INTO v_total   FROM public.permission_controls;
  SELECT COUNT(*) INTO v_actions FROM public.permission_controls WHERE kind = 'action';
  SELECT COUNT(*) INTO v_ctrls   FROM public.permission_controls WHERE kind = 'control';
  SELECT COUNT(*) INTO v_modules FROM public.modules;

  RAISE NOTICE 'permission_controls: total=% (actions=%, controls=%), módulos no catálogo=%',
    v_total, v_actions, v_ctrls, v_modules;

  IF v_actions <> v_modules * 5 THEN
    RAISE EXCEPTION 'Esperava % linhas de kind=action (=% módulos × 5 ações), encontrei %',
      v_modules * 5, v_modules, v_actions;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 7. Recarregar cache do PostgREST para refletir nova tabela e constraints
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
