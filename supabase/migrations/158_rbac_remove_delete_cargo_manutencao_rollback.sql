-- ============================================================
-- Rollback da Migration 158 — re-concede delete ao cargo manutencao
-- Criado em: 2026-06-16
--
-- Reverte o efeito de 158 no TEMPLATE (role_permissions): re-concede
-- delete=true ao cargo manutencao nos módulos 'equipamentos' e
-- 'manutencao'.
--
-- NOTA sobre simetria:
--   Antes da 158, role_permissions tinha (manutencao, equipamentos,
--   delete)=true e NÃO tinha linha para (manutencao, manutencao, delete).
--   Este rollback honra o intento "re-conceder delete nos DOIS módulos":
--   deixa ambas as linhas granted=true. A linha de manutencao.delete
--   passa a existir explicitamente como true (não volta a ser ausente),
--   o que é funcionalmente equivalente a conceder a permissão.
--
--   user_permissions NÃO é re-populado aqui: não há registro confiável de
--   quais usuários tinham a linha antes. Após este rollback, basta aplicar
--   o template do cargo (UI "Aplicar template do cargo" ou applyRoleTemplate)
--   para repropagar delete=true aos usuários do cargo manutencao.
--
-- Idempotente (ON CONFLICT DO UPDATE).
-- ============================================================

BEGIN;

INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('manutencao', 'equipamentos', 'delete', true),
  ('manutencao', 'manutencao',   'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE
  SET granted = EXCLUDED.granted,
      updated_at = now();

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.role_permissions
  WHERE role_code = 'manutencao'
    AND module_code IN ('manutencao', 'equipamentos')
    AND action = 'delete'
    AND granted = true;

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'Rollback falhou: esperava 2 linhas delete granted=true para cargo manutencao, encontrei %.',
      v_count;
  END IF;

  RAISE NOTICE 'OK (rollback 158): cargo manutencao com delete=true em equipamentos e manutencao no template.';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
