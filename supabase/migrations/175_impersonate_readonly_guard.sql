-- ============================================================
-- Migration 175 — Read-only no banco para o modo "Ver como" (impersonation 2A)
-- ============================================================
-- CONTEXTO:
--   O modo "Ver como" (suporte) vai passar a usar um JWT MINTADO server-side com a
--   identidade do usuario-alvo (sub = alvo) + um claim custom `impersonator` (o id do
--   super_admin real). Esse token e usado SO pelas leituras de dados no navegador, para
--   o suporte ver os dados reais do alvo (RLS resolve como o alvo). Spike confirmou:
--   o PostgREST aceita o token e resolve auth.uid() = alvo.
--
--   PROBLEMA: como a sessao de dados vira de fato o alvo (authenticated), sem trava o
--   suporte poderia GRAVAR como o usuario-alvo. O modo e estritamente somente-leitura.
--
-- ESTA MIGRATION (fundacao do read-only, imposto NO BANCO — nao no client):
--   1. helper `public.is_impersonating()` — true quando o JWT da requisicao carrega o
--      claim `impersonator` (presente apenas no token mintado do modo "Ver como").
--   2. `public.check_permission(...)` ganha um gate no TOPO: qualquer acao != 'view'
--      retorna FALSE quando `is_impersonating()` — bloqueia TODA escrita gateada por RBAC
--      (eventos, manutencao, atas, decoracao via RPCs, central_servicos, prestadores,
--      etc.), preservando as leituras (view).
--
--   IMPORTANTE — o corpo de check_permission e o BASELINE VIVO da migration 076 VERBATIM
--   (mantem o CASE EN->PT-BR de que policies de maintenance/settings/minutes ainda
--   dependem em ingles, e o SET search_path = public obrigatorio em SECURITY DEFINER).
--   A unica adicao e o bloco do gate no topo. (O banco de dev estava defasado nesse ponto;
--   esta migration tambem reconcilia o dev ao baseline 076.)
--
--   As poucas politicas de escrita por dono/role que NAO passam por check_permission
--   (comentarios de checklist, logs de upsell/recompra, notificacoes proprias,
--   pre-reservas, unit_settings, users self-update, etc.), as policies de escrita de
--   Storage e as RPCs SECURITY DEFINER que gravam sao gateadas na migration 176.
--
-- SEGURANCA / ESCOPO:
--   - `is_impersonating()` le SO o claim da requisicao (current_setting). Nenhum codigo
--     legitimo do app emite esse claim hoje -> esta migration e NO-OP ate o token mintado
--     existir (os endpoints chegam na fase seguinte). Seguro para deploy isolado.
--   - O gate vem ANTES do bypass de super_admin (defense-in-depth: mesmo que se mintasse
--     para um alvo privilegiado, a escrita fica barrada enquanto o claim estiver presente).
--   - O client server-side (createAdminClient/admin) usa o JWT do admin, SEM o claim ->
--     operacoes administrativas NAO sao afetadas.
--   - Idempotente (CREATE OR REPLACE). Sem BEGIN/COMMIT nem NOTIFY pgrst (a esteira cuida).
-- ============================================================

-- 1) Helper: detecta o modo "Ver como" pelo claim `impersonator` no JWT da requisicao.
--    STABLE (constante dentro da transacao). Nao precisa SECURITY DEFINER — le apenas o
--    GUC da propria requisicao. NULLIF + COALESCE evitam erro quando o GUC nao esta setado.
CREATE OR REPLACE FUNCTION public.is_impersonating()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'impersonator',
    ''
  ) <> '';
$function$;

GRANT EXECUTE ON FUNCTION public.is_impersonating() TO anon, authenticated, service_role;

-- 2) check_permission = baseline VERBATIM da migration 076 + gate de read-only no topo.
CREATE OR REPLACE FUNCTION public.check_permission(
  p_user_id uuid,
  p_module text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted BOOLEAN;
  v_role TEXT;
  v_module TEXT;
BEGIN
  -- Modo "Ver como" (impersonation): bloqueia QUALQUER escrita, preserva leituras.
  -- ANTES do bypass de super_admin de proposito (defense-in-depth).
  IF p_action <> 'view' AND public.is_impersonating() THEN
    RETURN FALSE;
  END IF;

  -- Super admin sempre pode
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Mapeia codigos legados EN -> PT-BR (compativel com migration 073)
  v_module := CASE p_module
    WHEN 'events'        THEN 'eventos'
    WHEN 'maintenance'   THEN 'manutencao'
    WHEN 'users'         THEN 'usuarios'
    WHEN 'reports'       THEN 'relatorios'
    WHEN 'audit_logs'    THEN 'logs'
    WHEN 'notifications' THEN 'notificacoes'
    WHEN 'settings'      THEN 'configuracoes'
    WHEN 'providers'     THEN 'prestadores'
    WHEN 'minutes'       THEN 'atas'
    ELSE p_module
  END;

  SELECT granted INTO v_granted
  FROM public.user_permissions
  WHERE user_id = p_user_id
    AND module = v_module
    AND action = p_action;

  RETURN COALESCE(v_granted, FALSE);
END;
$$;

COMMENT ON FUNCTION public.check_permission(uuid, text, text) IS
'Verifica permissao do usuario em (modulo, acao). Mapeia codigos EN legados (events, providers, etc) para PT-BR por causa da migration 073. Migration 175: bloqueia escrita (acao != view) quando is_impersonating() — modo "Ver como" e somente-leitura.';
