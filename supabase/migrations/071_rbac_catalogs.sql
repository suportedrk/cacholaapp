-- ============================================================
-- Migration 071 — RBAC Catalogs (PR 1 v1.5.4)
-- Criado em: 27/abr/2026
-- Autor: Claude Code
--
-- Baseline 1:1 do estado atual de src/config/roles.ts em 27/abr/2026.
-- Mudanças futuras nas permissões devem ser feitas via UI do PR 3 (não implementada).
--
-- DRIFT CONHECIDO: user_permissions.module ainda tem CHECK constraint com 8 valores
-- em inglês (events/maintenance/checklists/users/reports/audit_logs/notifications/settings)
-- do schema v001. Este catálogo usa codes PT-BR. Reconciliação programada para PR 3
-- (UPDATE registros + DROP/RECREATE CHECK constraint + sincronização motor de autorização).
-- Esta migration NÃO altera user_permissions.
--
-- CONSTANTES IGNORADAS (flags de visibilidade, não módulos de acesso):
--   - ADMIN_ACCESS_ROLES     : guarda pai de /admin — granularidade está nas sub-constantes
--   - GLOBAL_VIEWER_ROLES    : controla UnitSwitcher "Todas as unidades", não módulo
--   - VENDEDORA_ROLES        : identifica o role vendedora para seller_id, não acesso
-- ============================================================


-- ============================================================
-- FASE 2 — TABELAS DE CATÁLOGO
-- ============================================================

-- ------------------------------------------------------------
-- Tabela: modules
-- Catálogo de módulos do sistema. Fonte canônica futura para UI
-- de permissões. Codes em PT-BR (slug da rota).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  code        TEXT        PRIMARY KEY,
  label       TEXT        NOT NULL,
  description TEXT,
  icon        TEXT,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.modules IS
  'Catálogo de módulos do sistema. Code = slug PT-BR da rota. '
  'Baseline 1:1 de src/config/roles.ts em 27/abr/2026. '
  'UI de gestão implementada no PR 3.';

-- ------------------------------------------------------------
-- Tabela: roles
-- Catálogo de cargos (roles). Herança rígida planejada para PR 2.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  code        TEXT        PRIMARY KEY,
  label       TEXT        NOT NULL,
  description TEXT,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  is_system   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS
  'Catálogo de cargos disponíveis. is_system=true impede deleção via UI (apenas super_admin). '
  'Herança rígida (cargo → permissões) implementada no PR 2.';

-- ------------------------------------------------------------
-- Tabela: role_permissions
-- Template canônico de permissões por cargo × módulo × ação.
-- Leitura de autorização ainda feita por user_permissions (PR 2 muda isso).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_code   TEXT    NOT NULL REFERENCES public.roles(code)   ON DELETE CASCADE,
  module_code TEXT    NOT NULL REFERENCES public.modules(code) ON DELETE CASCADE,
  action      TEXT    NOT NULL CHECK (action IN ('view','create','edit','delete','export')),
  granted     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_code, module_code, action)
);

COMMENT ON TABLE public.role_permissions IS
  'Template canônico: cargo × módulo × ação. '
  'granted=true = permissão concedida por padrão para o cargo. '
  'Motor de autorização ainda lê user_permissions (até PR 2). '
  'Esta tabela é a fonte de verdade para popular user_permissions ao convidar usuários.';


-- ============================================================
-- TRIGGERS — updated_at (reutiliza update_updated_at() existente)
-- ============================================================

CREATE TRIGGER trg_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- FASE 3 — SEEDS
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 Seed: modules (20 linhas)
-- Sort_order segue a ordem da sidebar (nav-items.ts).
-- ------------------------------------------------------------
INSERT INTO public.modules (code, label, description, icon, sort_order, is_active)
VALUES
  -- Grupo principal
  ('dashboard',          'Início',                   'Calendário operacional e KPIs rápidos',                  'Home',           10,  true),
  ('bi',                 'BI',                        'Business Intelligence — visão estratégica',              'BarChart3',      20,  true),
  ('bi_atendimento',     'BI - Atendimento',          'BI — análise de deals e atendimento (Ploomes)',          'BarChart3',      21,  true),
  ('bi_vendas',          'BI - Vendas',               'BI — vendas realizadas (orders) e categorias',          'BarChart3',      22,  true),
  ('vendas',             'Vendas',                    'Módulo de gestão comercial (upsell, recompra)',          'TrendingUp',     30,  true),
  ('checklist_comercial','Checklist Comercial',       'Tarefas, templates e automações do funil comercial',    'ClipboardCheck', 40,  true),
  ('eventos',            'Eventos',                   'Gestão de festas agendadas',                            'CalendarDays',   50,  true),
  ('checklists',         'Checklists Operacionais',   'Checklists de festa, recorrências e tarefas da equipe', 'ClipboardList',  60,  true),
  -- Grupo Operações
  ('manutencao',         'Manutenção',                'Ordens de manutenção, dashboard e configurações',       'Wrench',         70,  true),
  ('equipamentos',       'Equipamentos',              'Cadastro e gestão de ativos/equipamentos',              'Package',        80,  true),
  ('prestadores',        'Prestadores',               'Gestão de prestadores de serviço externos',             'Handshake',      90,  true),
  ('atas',               'Atas de Reunião',           'Criação, publicação e export de atas',                  'FileText',       100, true),
  ('relatorios',         'Relatórios',                'Relatórios operacionais e financeiros',                 'BarChart3',      110, true),
  -- Grupo Administração
  ('usuarios',           'Usuários',                  'Gestão de usuários, convites e permissões',             'Users',          120, true),
  ('unidades',           'Unidades',                  'Gestão de unidades do negócio',                        'Building2',      130, true),
  ('logs',               'Logs de Auditoria',         'Trilha de auditoria de ações no sistema',               'ScrollText',     140, true),
  ('backups',            'Backups',                   'Dashboard de backups e download de arquivos',           'HardDrive',      150, true),
  ('vendedoras',         'Vendedoras',                'Cadastro mestre de vendedoras e vínculo com usuários',  'UserCog',        160, true),
  ('configuracoes',      'Configurações',             'Configurações gerais e regras de negócio',              'Settings',       170, true),
  -- Sem rota própria (geradas pelo sistema)
  ('notificacoes',       'Notificações',              'Notificações in-app geradas pelo sistema',              'Bell',           180, true)
ON CONFLICT (code) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();


-- ------------------------------------------------------------
-- 3.2 Seed: roles (11 linhas)
-- is_system=true apenas para super_admin — impede deleção via UI.
-- ------------------------------------------------------------
INSERT INTO public.roles (code, label, description, sort_order, is_active, is_system)
VALUES
  ('super_admin', 'Super Admin (T.I.)', 'Acesso total irrestrito. Conta de T.I. e suporte.',           10,  true, true),
  ('diretor',     'Diretor',            'Visão estratégica, relatórios e aprovações.',                  20,  true, false),
  ('gerente',     'Gerente',            'Gestão operacional: eventos, equipe, checklists.',              30,  true, false),
  ('vendedora',   'Vendedora',          'Eventos vinculados e módulo de vendas (upsell/recompra).',     40,  true, false),
  ('pos_vendas',  'Pós-Vendas',         'Pós-venda transversal: vendas, eventos e atas. Visão global.', 50,  true, false),
  ('decoracao',   'Decoração',          'Checklists de decoração e fotos de eventos.',                  60,  true, false),
  ('manutencao',  'Manutenção',         'Ordens de manutenção e checklists técnicos.',                  70,  true, false),
  ('financeiro',  'Financeiro',         'Relatórios, valores e visão de BI de vendas.',                 80,  true, false),
  ('rh',          'RH',                 'Gestão de usuários, escalas e eventos.',                       90,  true, false),
  ('freelancer',  'Freelancer',         'Evento do dia e checklist designado.',                         100, true, false),
  ('entregador',  'Entregador',         'Rotas do dia e checklist de carga.',                           110, true, false)
ON CONFLICT (code) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();


-- ------------------------------------------------------------
-- 3.3 Seed: role_permissions (template canônico)
--
-- Organizado por constante de src/config/roles.ts.
-- super_admin recebe acesso total via CROSS JOIN no bloco final.
-- Todas as linhas abaixo excluem super_admin (já coberto pelo bloco all-access).
--
-- NOTA: checklists.view é governado por OPERATIONAL_CHECKLIST_ROLES.
-- TEAM_TASKS_ROLES ⊆ OPERATIONAL_CHECKLIST_ROLES — mesma action 'view',
-- escopo de equipe é controlado no código (sem action separada neste PR).
--
-- NOTA: relatorios.view usa BI_ACCESS_ROLES (nav-items.ts + relatorios/layout.tsx).
-- ------------------------------------------------------------

-- ── BI_ACCESS_ROLES → (bi, view) ─────────────────────────────
-- Também governa (relatorios, view) — mesma restrição de layout.
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'bi',         'view', true),
  ('diretor', 'relatorios', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── BI_ATENDIMENTO_ROLES → (bi_atendimento, view) ────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'bi_atendimento', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── BI_VENDAS_ROLES → (bi_vendas, view) ──────────────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'bi_vendas', 'view', true),
  ('gerente',    'bi_vendas', 'view', true),
  ('financeiro', 'bi_vendas', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── DASHBOARD_ACCESS_ROLES → (dashboard, view) ───────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'dashboard', 'view', true),
  ('gerente',    'dashboard', 'view', true),
  ('financeiro', 'dashboard', 'view', true),
  ('manutencao', 'dashboard', 'view', true),
  ('vendedora',  'dashboard', 'view', true),
  ('pos_vendas', 'dashboard', 'view', true),
  ('decoracao',  'dashboard', 'view', true),
  ('rh',         'dashboard', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── VENDAS_MODULE_ROLES → (vendas, view) ─────────────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'vendas', 'view', true),
  ('vendedora',  'vendas', 'view', true),
  ('pos_vendas', 'vendas', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── VENDAS_MANAGE_ROLES → (vendas, create) e (vendas, edit) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'vendas', 'create', true),
  ('diretor', 'vendas', 'edit',   true),
  ('gerente', 'vendas', 'create', true),
  ('gerente', 'vendas', 'edit',   true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── COMMERCIAL_CHECKLIST_ACCESS_ROLES → (checklist_comercial, view) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'checklist_comercial', 'view', true),
  ('vendedora',  'checklist_comercial', 'view', true),
  ('pos_vendas', 'checklist_comercial', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── COMMERCIAL_CHECKLIST_MANAGE_ROLES → (checklist_comercial, create) e (edit) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'checklist_comercial', 'create', true),
  ('diretor', 'checklist_comercial', 'edit',   true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── COMMERCIAL_CHECKLIST_ARCHIVE_ROLES → (checklist_comercial, delete) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'checklist_comercial', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── EVENTOS_ACCESS_ROLES → (eventos, view) ───────────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'eventos', 'view', true),
  ('gerente',    'eventos', 'view', true),
  ('financeiro', 'eventos', 'view', true),
  ('vendedora',  'eventos', 'view', true),
  ('pos_vendas', 'eventos', 'view', true),
  ('decoracao',  'eventos', 'view', true),
  ('rh',         'eventos', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── OPERATIONAL_CHECKLIST_ROLES → (checklists, view) ─────────
-- TEAM_TASKS_ROLES ⊆ OPERATIONAL_CHECKLIST_ROLES: escopo de equipe
-- é controlado no código, sem action separada neste catálogo.
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'checklists', 'view', true),
  ('gerente',    'checklists', 'view', true),
  ('decoracao',  'checklists', 'view', true),
  ('freelancer', 'checklists', 'view', true),
  ('entregador', 'checklists', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── MAINTENANCE_MODULE_ROLES → (manutencao, view) e (equipamentos, view) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'manutencao',   'view', true),
  ('gerente',    'manutencao',   'view', true),
  ('manutencao', 'manutencao',   'view', true),
  ('diretor',    'equipamentos', 'view', true),
  ('gerente',    'equipamentos', 'view', true),
  ('manutencao', 'equipamentos', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── MAINTENANCE_ADMIN_ROLES → (manutencao, create/edit/delete) e (equipamentos, create/edit/delete) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'manutencao',   'create', true),
  ('diretor', 'manutencao',   'edit',   true),
  ('diretor', 'manutencao',   'delete', true),
  ('gerente', 'manutencao',   'create', true),
  ('gerente', 'manutencao',   'edit',   true),
  ('gerente', 'manutencao',   'delete', true),
  ('diretor', 'equipamentos', 'create', true),
  ('diretor', 'equipamentos', 'edit',   true),
  ('diretor', 'equipamentos', 'delete', true),
  ('gerente', 'equipamentos', 'create', true),
  ('gerente', 'equipamentos', 'edit',   true),
  ('gerente', 'equipamentos', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── PRESTADORES_ACCESS_ROLES → (prestadores, view) ───────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'prestadores', 'view', true),
  ('gerente',    'prestadores', 'view', true),
  ('financeiro', 'prestadores', 'view', true),
  ('manutencao', 'prestadores', 'view', true),
  ('vendedora',  'prestadores', 'view', true),
  ('pos_vendas', 'prestadores', 'view', true),
  ('decoracao',  'prestadores', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── ATAS_ACCESS_ROLES → (atas, view) ─────────────────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'atas', 'view', true),
  ('gerente',    'atas', 'view', true),
  ('financeiro', 'atas', 'view', true),
  ('vendedora',  'atas', 'view', true),
  ('pos_vendas', 'atas', 'view', true),
  ('decoracao',  'atas', 'view', true),
  ('rh',         'atas', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── ADMIN_USERS_MANAGE_ROLES → (usuarios, view/create/edit/delete) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'usuarios', 'view',   true),
  ('diretor', 'usuarios', 'create', true),
  ('diretor', 'usuarios', 'edit',   true),
  ('diretor', 'usuarios', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── ADMIN_UNITS_MANAGE_ROLES → (unidades, view/create/edit/delete) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'unidades', 'view',   true),
  ('diretor', 'unidades', 'create', true),
  ('diretor', 'unidades', 'edit',   true),
  ('diretor', 'unidades', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── ADMIN_LOGS_VIEW_ROLES → (logs, view) ─────────────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'logs', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── BACKUP_VIEW_ROLES → (backups, view) ──────────────────────
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'backups', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── SELLERS_MANAGE_ROLES → (vendedoras, view/create/edit/delete) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'vendedoras', 'view',   true),
  ('diretor', 'vendedoras', 'create', true),
  ('diretor', 'vendedoras', 'edit',   true),
  ('diretor', 'vendedoras', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── SETTINGS_ROLES → (configuracoes, view) e (configuracoes, edit) ──
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'configuracoes', 'view', true),
  ('diretor', 'configuracoes', 'edit', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── Notificações: todos os 11 cargos recebem (notificacoes, view) ────
-- Notificações são geradas pelo sistema; usuários só visualizam.
-- Sem create/edit/delete para nenhum cargo (exceto super_admin via all-access abaixo).
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'notificacoes', 'view', true),
  ('gerente',    'notificacoes', 'view', true),
  ('financeiro', 'notificacoes', 'view', true),
  ('manutencao', 'notificacoes', 'view', true),
  ('vendedora',  'notificacoes', 'view', true),
  ('pos_vendas', 'notificacoes', 'view', true),
  ('decoracao',  'notificacoes', 'view', true),
  ('rh',         'notificacoes', 'view', true),
  ('freelancer', 'notificacoes', 'view', true),
  ('entregador', 'notificacoes', 'view', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- ── super_admin: acesso total a todos os módulos e ações ──────
-- 20 módulos × 5 ações = 100 linhas. CROSS JOIN garante cobertura
-- completa mesmo quando novas (module, action) forem inseridas.
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
SELECT
  'super_admin'  AS role_code,
  m.code         AS module_code,
  a.action       AS action,
  true           AS granted
FROM public.modules m
CROSS JOIN (
  VALUES ('view'),('create'),('edit'),('delete'),('export')
) AS a(action)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();


-- ============================================================
-- FASE 4 — RLS (Row Level Security)
-- Catálogos são leitura pública para autenticados.
-- Escrita restrita ao service_role (gestão via SQL até PR 3).
-- ============================================================

ALTER TABLE public.modules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler os catálogos (UI precisa)
CREATE POLICY "modules_select_authenticated"
  ON public.modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- INSERT / UPDATE / DELETE: apenas service_role (bypass RLS)
-- Nenhuma política de escrita para authenticated — todo INSERT/UPDATE/DELETE
-- deve usar service_role key (migrations SQL ou API route com service client).
-- UI de gestão implementada no PR 3 usará service_role via API route protegida.

COMMENT ON TABLE public.modules IS
  'Catálogo de módulos do sistema. Code = slug PT-BR da rota. '
  'Baseline 1:1 de src/config/roles.ts em 27/abr/2026. '
  'RLS: SELECT para authenticated. Escrita via service_role apenas. '
  'UI de gestão implementada no PR 3.';

COMMENT ON TABLE public.roles IS
  'Catálogo de cargos disponíveis. is_system=true impede deleção via UI (apenas super_admin). '
  'Herança rígida (cargo → permissões) implementada no PR 2. '
  'RLS: SELECT para authenticated. Escrita via service_role apenas.';

COMMENT ON TABLE public.role_permissions IS
  'Template canônico: cargo × módulo × ação. '
  'granted=true = permissão concedida por padrão para o cargo. '
  'Motor de autorização ainda lê user_permissions (até PR 2). '
  'RLS: SELECT para authenticated. Escrita via service_role apenas.';
