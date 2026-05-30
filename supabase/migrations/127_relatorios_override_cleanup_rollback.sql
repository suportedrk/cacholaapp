-- ============================================================
-- Rollback da Migration 127 — Relatórios: restaura overrides removidos
--
-- Re-insere os grants de relatorios que a 127 removeu,
-- resolvendo por e-mail (ON CONFLICT DO NOTHING para idempotência).
--
-- ⚠ LIMITAÇÃO: não há como garantir que os grants eram pré-existentes
-- antes da 127 vs inseridos por outra migration futura. Como se tratam
-- de contas de teste do dono (brunocasaletti@* em prod; teste.* em local),
-- o valor dessas linhas é baixo — restauramos como best-effort por e-mail.
--
-- Contas restauradas:
--   PRODUÇÃO:
--     brunocasaletti@gmail.com  (gerente): create, delete, edit, export, view
--     brunocasaletti@hotmail.com (gerente): view
--   LOCAL (seed):
--     teste.gerente@cachola.local    (gerente):    view
--     teste.financeiro@cachola.local (financeiro): view, export
--   (A query usa subselect por email — ignora silenciosamente se o
--   usuário não existir no ambiente onde o rollback é executado.)
--
-- Idempotente.
-- ============================================================

BEGIN;

-- Re-insere por e-mail para ser portável entre prod e local
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT u.id, NULL::UUID, 'relatorios', a.action, true
FROM public.users u
CROSS JOIN (VALUES
  ('brunocasaletti@gmail.com',       'create'),
  ('brunocasaletti@gmail.com',       'delete'),
  ('brunocasaletti@gmail.com',       'edit'),
  ('brunocasaletti@gmail.com',       'export'),
  ('brunocasaletti@gmail.com',       'view'),
  ('brunocasaletti@hotmail.com',     'view'),
  ('teste.gerente@cachola.local',    'view'),
  ('teste.financeiro@cachola.local', 'view'),
  ('teste.financeiro@cachola.local', 'export')
) AS a(email, action)
WHERE u.email = a.email
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
