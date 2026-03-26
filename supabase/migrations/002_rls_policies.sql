-- ============================================================
-- Cachola OS — Migration 002: Row Level Security (RLS)
-- ============================================================
-- Habilita RLS em todas as tabelas com dados sensíveis e
-- cria as policies de acesso.
--
-- Modelo de permissões:
-- - Verificação via tabela user_permissions
-- - Função auxiliar: check_permission(user_id, module, action)
-- ============================================================

-- ============================================================
-- Função auxiliar: verifica se usuário tem permissão
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_permission(
  p_user_id UUID,
  p_module  TEXT,
  p_action  TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_granted BOOLEAN;
  v_role TEXT;
BEGIN
  -- super_admin tem acesso total (bypass de permissões)
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Verifica permissão customizada do usuário
  SELECT granted INTO v_granted
  FROM public.user_permissions
  WHERE user_id = p_user_id
    AND module = p_module
    AND action = p_action;

  RETURN COALESCE(v_granted, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Função: retorna user_id do usuário autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TABELA: users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Usuário vê seu próprio perfil
CREATE POLICY "users: self view"
  ON public.users FOR SELECT
  USING (id = auth_user_id());

-- Admin vê todos
CREATE POLICY "users: admin view all"
  ON public.users FOR SELECT
  USING (check_permission(auth_user_id(), 'users', 'view'));

-- Usuário atualiza seu próprio perfil
CREATE POLICY "users: self update"
  ON public.users FOR UPDATE
  USING (id = auth_user_id())
  WITH CHECK (id = auth_user_id());

-- Admin cria usuários
CREATE POLICY "users: admin create"
  ON public.users FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'users', 'create'));

-- Admin atualiza qualquer usuário
CREATE POLICY "users: admin update"
  ON public.users FOR UPDATE
  USING (check_permission(auth_user_id(), 'users', 'edit'));

-- Admin desativa usuários (soft delete via is_active)
CREATE POLICY "users: admin delete"
  ON public.users FOR DELETE
  USING (check_permission(auth_user_id(), 'users', 'delete'));

-- ============================================================
-- TABELA: user_permissions
-- ============================================================
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Somente admin de users gerencia permissões
CREATE POLICY "user_permissions: admin manage"
  ON public.user_permissions FOR ALL
  USING (check_permission(auth_user_id(), 'users', 'edit'));

-- Usuário vê suas próprias permissões
CREATE POLICY "user_permissions: self view"
  ON public.user_permissions FOR SELECT
  USING (user_id = auth_user_id());

-- ============================================================
-- TABELA: role_default_perms
-- ============================================================
ALTER TABLE public.role_default_perms ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ler templates de permissão
CREATE POLICY "role_default_perms: authenticated read"
  ON public.role_default_perms FOR SELECT
  USING (auth_user_id() IS NOT NULL);

-- Somente super_admin gerencia templates
CREATE POLICY "role_default_perms: super_admin manage"
  ON public.role_default_perms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth_user_id() AND role = 'super_admin'
    )
  );

-- ============================================================
-- TABELA: events
-- ============================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Visualizar: quem tem permissão OU está na equipe do evento
CREATE POLICY "events: view"
  ON public.events FOR SELECT
  USING (
    check_permission(auth_user_id(), 'events', 'view')
    OR created_by = auth_user_id()
    OR EXISTS (
      SELECT 1 FROM public.event_staff
      WHERE event_id = events.id AND user_id = auth_user_id()
    )
  );

CREATE POLICY "events: create"
  ON public.events FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'events', 'create'));

CREATE POLICY "events: update"
  ON public.events FOR UPDATE
  USING (check_permission(auth_user_id(), 'events', 'edit'));

CREATE POLICY "events: delete"
  ON public.events FOR DELETE
  USING (check_permission(auth_user_id(), 'events', 'delete'));

-- ============================================================
-- TABELA: event_staff
-- ============================================================
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_staff: view"
  ON public.event_staff FOR SELECT
  USING (
    check_permission(auth_user_id(), 'events', 'view')
    OR user_id = auth_user_id()
  );

CREATE POLICY "event_staff: manage"
  ON public.event_staff FOR ALL
  USING (check_permission(auth_user_id(), 'events', 'edit'));

-- ============================================================
-- TABELA: checklist_templates
-- ============================================================
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_templates: view"
  ON public.checklist_templates FOR SELECT
  USING (
    check_permission(auth_user_id(), 'checklists', 'view')
    AND is_active = TRUE
  );

CREATE POLICY "checklist_templates: manage"
  ON public.checklist_templates FOR ALL
  USING (check_permission(auth_user_id(), 'checklists', 'create'));

-- ============================================================
-- TABELA: template_items
-- ============================================================
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_items: view"
  ON public.template_items FOR SELECT
  USING (check_permission(auth_user_id(), 'checklists', 'view'));

CREATE POLICY "template_items: manage"
  ON public.template_items FOR ALL
  USING (check_permission(auth_user_id(), 'checklists', 'create'));

-- ============================================================
-- TABELA: checklists
-- ============================================================
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists: view"
  ON public.checklists FOR SELECT
  USING (
    check_permission(auth_user_id(), 'checklists', 'view')
    OR assigned_to = auth_user_id()
  );

CREATE POLICY "checklists: create"
  ON public.checklists FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'checklists', 'create'));

CREATE POLICY "checklists: update"
  ON public.checklists FOR UPDATE
  USING (
    check_permission(auth_user_id(), 'checklists', 'edit')
    OR assigned_to = auth_user_id()
  );

CREATE POLICY "checklists: delete"
  ON public.checklists FOR DELETE
  USING (check_permission(auth_user_id(), 'checklists', 'delete'));

-- ============================================================
-- TABELA: checklist_items
-- ============================================================
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items: view"
  ON public.checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND (
          check_permission(auth_user_id(), 'checklists', 'view')
          OR c.assigned_to = auth_user_id()
        )
    )
  );

CREATE POLICY "checklist_items: manage"
  ON public.checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND (
          check_permission(auth_user_id(), 'checklists', 'edit')
          OR c.assigned_to = auth_user_id()
        )
    )
  );

-- ============================================================
-- TABELA: maintenance_orders
-- ============================================================
ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance: view"
  ON public.maintenance_orders FOR SELECT
  USING (
    check_permission(auth_user_id(), 'maintenance', 'view')
    OR assigned_to = auth_user_id()
    OR created_by = auth_user_id()
  );

CREATE POLICY "maintenance: create"
  ON public.maintenance_orders FOR INSERT
  WITH CHECK (check_permission(auth_user_id(), 'maintenance', 'create'));

CREATE POLICY "maintenance: update"
  ON public.maintenance_orders FOR UPDATE
  USING (
    check_permission(auth_user_id(), 'maintenance', 'edit')
    OR assigned_to = auth_user_id()
  );

CREATE POLICY "maintenance: delete"
  ON public.maintenance_orders FOR DELETE
  USING (check_permission(auth_user_id(), 'maintenance', 'delete'));

-- ============================================================
-- TABELA: maintenance_photos
-- ============================================================
ALTER TABLE public.maintenance_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_photos: view"
  ON public.maintenance_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_orders mo
      WHERE mo.id = maintenance_photos.order_id
        AND (
          check_permission(auth_user_id(), 'maintenance', 'view')
          OR mo.assigned_to = auth_user_id()
        )
    )
  );

CREATE POLICY "maintenance_photos: manage"
  ON public.maintenance_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_orders mo
      WHERE mo.id = maintenance_photos.order_id
        AND (
          check_permission(auth_user_id(), 'maintenance', 'edit')
          OR mo.assigned_to = auth_user_id()
        )
    )
  );

-- ============================================================
-- TABELA: notifications
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Usuário vê/gerencia apenas suas notificações
CREATE POLICY "notifications: own"
  ON public.notifications FOR ALL
  USING (user_id = auth_user_id());

-- Service role insere notificações para qualquer usuário
CREATE POLICY "notifications: service insert"
  ON public.notifications FOR INSERT
  WITH CHECK (TRUE);  -- controlado pelo service_role no backend

-- ============================================================
-- TABELA: audit_logs
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: view"
  ON public.audit_logs FOR SELECT
  USING (check_permission(auth_user_id(), 'audit_logs', 'view'));

-- Inserção via service_role (servidor), não diretamente pelo usuário
CREATE POLICY "audit_logs: insert service"
  ON public.audit_logs FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- TABELA: system_config
-- ============================================================
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Todos leem configurações ativas
CREATE POLICY "system_config: authenticated read"
  ON public.system_config FOR SELECT
  USING (auth_user_id() IS NOT NULL AND is_active = TRUE);

-- Somente admin edita configurações
CREATE POLICY "system_config: admin manage"
  ON public.system_config FOR ALL
  USING (check_permission(auth_user_id(), 'settings', 'edit'));
