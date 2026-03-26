-- ============================================================
-- Cachola OS — Migration 003: Funções e Triggers
-- ============================================================

-- ============================================================
-- Trigger: Ao criar usuário no GoTrue (auth.users),
-- cria automaticamente o perfil em public.users
-- e carrega permissões padrão do role
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
BEGIN
  -- Extrai role e nome dos metadados do GoTrue
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'freelancer');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Cria perfil público
  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  -- Carrega permissões padrão do role escolhido
  INSERT INTO public.user_permissions (user_id, module, action, granted)
  SELECT NEW.id, module, action, granted
  FROM public.role_default_perms
  WHERE role = v_role
  ON CONFLICT (user_id, module, action) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Função: Recarregar permissões de um usuário com base no role
-- Útil quando o admin muda o role de um usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.reload_user_permissions(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;

  -- Remove permissões existentes
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;

  -- Recarrega do template do novo role
  INSERT INTO public.user_permissions (user_id, module, action, granted)
  SELECT p_user_id, module, action, granted
  FROM public.role_default_perms
  WHERE role = v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Função: Retorna todas as permissões de um usuário como JSON
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT module, action, granted
    FROM public.user_permissions
    WHERE user_id = p_user_id
  LOOP
    v_result := jsonb_set(
      v_result,
      ARRAY[v_row.module, v_row.action],
      to_jsonb(v_row.granted)
    );
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Função: Conta notificações não lidas de um usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Função: Marca todas as notificações de um usuário como lidas
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
  UPDATE public.notifications
  SET is_read = TRUE
  WHERE user_id = p_user_id AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- Trigger: Audit log automático em events
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_module TEXT;
BEGIN
  -- Determina ação
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_data := to_jsonb(OLD);
  END IF;

  -- Mapeia tabela para módulo
  v_module := CASE TG_TABLE_NAME
    WHEN 'events'              THEN 'events'
    WHEN 'maintenance_orders'  THEN 'maintenance'
    WHEN 'checklists'          THEN 'checklists'
    WHEN 'users'               THEN 'users'
    ELSE TG_TABLE_NAME
  END;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    module,
    entity_id,
    entity_type,
    old_data,
    new_data
  )
  VALUES (
    auth.uid(),
    v_action,
    v_module,
    CASE WHEN TG_OP = 'DELETE' THEN (v_old_data->>'id')::UUID
         ELSE (v_new_data->>'id')::UUID
    END,
    TG_TABLE_NAME,
    v_old_data,
    v_new_data
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplica audit trigger nas tabelas principais
CREATE OR REPLACE TRIGGER audit_events
  AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_maintenance_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
