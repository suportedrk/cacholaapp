-- ============================================================
-- Cachola OS — Migration 004: Seed de dados iniciais
-- ============================================================
-- Dados: role_default_perms, system_config
-- Usuário super_admin: criado via Supabase Auth (ver README)
-- ============================================================

-- ============================================================
-- PERMISSÕES PADRÃO POR ROLE
-- ============================================================

-- super_admin: TUDO
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('super_admin', 'events',      'view',   TRUE),
  ('super_admin', 'events',      'create', TRUE),
  ('super_admin', 'events',      'edit',   TRUE),
  ('super_admin', 'events',      'delete', TRUE),
  ('super_admin', 'events',      'export', TRUE),
  ('super_admin', 'maintenance', 'view',   TRUE),
  ('super_admin', 'maintenance', 'create', TRUE),
  ('super_admin', 'maintenance', 'edit',   TRUE),
  ('super_admin', 'maintenance', 'delete', TRUE),
  ('super_admin', 'maintenance', 'export', TRUE),
  ('super_admin', 'checklists',  'view',   TRUE),
  ('super_admin', 'checklists',  'create', TRUE),
  ('super_admin', 'checklists',  'edit',   TRUE),
  ('super_admin', 'checklists',  'delete', TRUE),
  ('super_admin', 'checklists',  'export', TRUE),
  ('super_admin', 'users',       'view',   TRUE),
  ('super_admin', 'users',       'create', TRUE),
  ('super_admin', 'users',       'edit',   TRUE),
  ('super_admin', 'users',       'delete', TRUE),
  ('super_admin', 'users',       'export', TRUE),
  ('super_admin', 'reports',     'view',   TRUE),
  ('super_admin', 'reports',     'create', TRUE),
  ('super_admin', 'reports',     'edit',   TRUE),
  ('super_admin', 'reports',     'delete', TRUE),
  ('super_admin', 'reports',     'export', TRUE),
  ('super_admin', 'audit_logs',  'view',   TRUE),
  ('super_admin', 'audit_logs',  'export', TRUE),
  ('super_admin', 'notifications','view',  TRUE),
  ('super_admin', 'settings',    'view',   TRUE),
  ('super_admin', 'settings',    'create', TRUE),
  ('super_admin', 'settings',    'edit',   TRUE),
  ('super_admin', 'settings',    'delete', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- diretor: visualizar tudo + exportar relatórios
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('diretor', 'events',       'view',   TRUE),
  ('diretor', 'events',       'create', FALSE),
  ('diretor', 'events',       'edit',   FALSE),
  ('diretor', 'events',       'delete', FALSE),
  ('diretor', 'events',       'export', TRUE),
  ('diretor', 'maintenance',  'view',   TRUE),
  ('diretor', 'maintenance',  'export', TRUE),
  ('diretor', 'checklists',   'view',   TRUE),
  ('diretor', 'users',        'view',   TRUE),
  ('diretor', 'reports',      'view',   TRUE),
  ('diretor', 'reports',      'export', TRUE),
  ('diretor', 'audit_logs',   'view',   TRUE),
  ('diretor', 'notifications','view',   TRUE),
  ('diretor', 'settings',     'view',   TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- gerente: gestão completa de eventos e operação
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('gerente', 'events',       'view',   TRUE),
  ('gerente', 'events',       'create', TRUE),
  ('gerente', 'events',       'edit',   TRUE),
  ('gerente', 'events',       'delete', FALSE),
  ('gerente', 'events',       'export', TRUE),
  ('gerente', 'maintenance',  'view',   TRUE),
  ('gerente', 'maintenance',  'create', TRUE),
  ('gerente', 'maintenance',  'edit',   TRUE),
  ('gerente', 'maintenance',  'delete', FALSE),
  ('gerente', 'checklists',   'view',   TRUE),
  ('gerente', 'checklists',   'create', TRUE),
  ('gerente', 'checklists',   'edit',   TRUE),
  ('gerente', 'users',        'view',   TRUE),
  ('gerente', 'reports',      'view',   TRUE),
  ('gerente', 'notifications','view',   TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- vendedora: eventos vinculados
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('vendedora', 'events',        'view',   TRUE),
  ('vendedora', 'events',        'create', TRUE),
  ('vendedora', 'events',        'edit',   TRUE),
  ('vendedora', 'checklists',    'view',   TRUE),
  ('vendedora', 'checklists',    'edit',   TRUE),
  ('vendedora', 'notifications', 'view',   TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- decoracao: checklists de decoração
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('decoracao', 'events',        'view',  TRUE),
  ('decoracao', 'checklists',    'view',  TRUE),
  ('decoracao', 'checklists',    'edit',  TRUE),
  ('decoracao', 'notifications', 'view',  TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- manutencao: ordens de manutenção
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('manutencao', 'maintenance',  'view',   TRUE),
  ('manutencao', 'maintenance',  'create', TRUE),
  ('manutencao', 'maintenance',  'edit',   TRUE),
  ('manutencao', 'checklists',   'view',   TRUE),
  ('manutencao', 'checklists',   'edit',   TRUE),
  ('manutencao', 'notifications','view',   TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- financeiro: relatórios e visualização
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('financeiro', 'events',       'view',   TRUE),
  ('financeiro', 'events',       'export', TRUE),
  ('financeiro', 'reports',      'view',   TRUE),
  ('financeiro', 'reports',      'export', TRUE),
  ('financeiro', 'notifications','view',   TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- rh: gestão de usuários
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('rh', 'users',        'view',   TRUE),
  ('rh', 'users',        'create', TRUE),
  ('rh', 'users',        'edit',   TRUE),
  ('rh', 'events',       'view',   TRUE),
  ('rh', 'notifications','view',   TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- freelancer: evento do dia + checklist designado
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('freelancer', 'events',        'view',  TRUE),
  ('freelancer', 'checklists',    'view',  TRUE),
  ('freelancer', 'checklists',    'edit',  TRUE),
  ('freelancer', 'notifications', 'view',  TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- entregador: rotas + checklist de carga
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('entregador', 'events',        'view', TRUE),
  ('entregador', 'checklists',    'view', TRUE),
  ('entregador', 'checklists',    'edit', TRUE),
  ('entregador', 'notifications', 'view', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- ============================================================
-- CONFIGURAÇÕES DO SISTEMA (valores de select configuráveis)
-- ============================================================

-- Tipos de evento
INSERT INTO public.system_config (category, key, label, sort_order) VALUES
  ('event_types', 'festa_infantil',   'Festa Infantil',       1),
  ('event_types', 'aniversario',      'Aniversário',          2),
  ('event_types', 'formatura',        'Formatura',            3),
  ('event_types', 'confraternizacao', 'Confraternização',     4),
  ('event_types', 'casamento',        'Casamento',            5),
  ('event_types', 'outros',           'Outros',               99)
ON CONFLICT (category, key) DO NOTHING;

-- Pacotes (configurar conforme pacotes reais do buffet)
INSERT INTO public.system_config (category, key, label, sort_order) VALUES
  ('packages', 'basico',    'Pacote Básico',    1),
  ('packages', 'standard',  'Pacote Standard',  2),
  ('packages', 'premium',   'Pacote Premium',   3),
  ('packages', 'vip',       'Pacote VIP',       4),
  ('packages', 'personalizado', 'Personalizado', 99)
ON CONFLICT (category, key) DO NOTHING;

-- Setores (para manutenção)
INSERT INTO public.system_config (category, key, label, sort_order) VALUES
  ('sectors', 'salao_principal', 'Salão Principal',  1),
  ('sectors', 'banheiro_adulto', 'Banheiro Adulto',  2),
  ('sectors', 'banheiro_kids',   'Banheiro Kids',    3),
  ('sectors', 'cozinha',         'Cozinha',          4),
  ('sectors', 'area_externa',    'Área Externa',     5),
  ('sectors', 'deposito',        'Depósito',         6),
  ('sectors', 'escritorio',      'Escritório',       7),
  ('sectors', 'estacionamento',  'Estacionamento',   8),
  ('sectors', 'geral',           'Geral',            99)
ON CONFLICT (category, key) DO NOTHING;

-- Funções no evento (event_staff)
INSERT INTO public.system_config (category, key, label, sort_order) VALUES
  ('roles_in_event', 'garcom',           'Garçom',          1),
  ('roles_in_event', 'garconete',        'Garçonete',       2),
  ('roles_in_event', 'monitor',          'Monitor',         3),
  ('roles_in_event', 'monitora',         'Monitora',        4),
  ('roles_in_event', 'decoradora',       'Decoradora',      5),
  ('roles_in_event', 'cozinheiro',       'Cozinheiro',      6),
  ('roles_in_event', 'gerente_evento',   'Gerente do Evento', 7),
  ('roles_in_event', 'dj',               'DJ',              8),
  ('roles_in_event', 'fotografo',        'Fotógrafo',       9),
  ('roles_in_event', 'seguranca',        'Segurança',       10)
ON CONFLICT (category, key) DO NOTHING;

-- Categorias de checklist
INSERT INTO public.system_config (category, key, label, sort_order) VALUES
  ('checklist_categories', 'pre_evento',    'Pré-Evento',    1),
  ('checklist_categories', 'durante',       'Durante Evento',2),
  ('checklist_categories', 'pos_evento',    'Pós-Evento',    3),
  ('checklist_categories', 'abertura_dia',  'Abertura do Dia',4),
  ('checklist_categories', 'fechamento_dia','Fechamento do Dia',5),
  ('checklist_categories', 'manutencao',    'Manutenção',    6),
  ('checklist_categories', 'outros',        'Outros',        99)
ON CONFLICT (category, key) DO NOTHING;
