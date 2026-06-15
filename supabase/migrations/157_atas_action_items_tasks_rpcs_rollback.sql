-- Rollback da migration 157 — remove as RPCs de "Minhas Tarefas" das Atas (Fase A1).
--
-- Remove apenas as duas funções novas criadas na 157. Nenhuma RLS, policy ou
-- can_view_meeting foi alterada na 157, portanto nada mais a reverter.

BEGIN;

DROP FUNCTION IF EXISTS public.get_my_action_items();
DROP FUNCTION IF EXISTS public.set_my_action_item_status(UUID, TEXT);

COMMIT;

NOTIFY pgrst, 'reload schema';
