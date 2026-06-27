-- ============================================================
-- ROLLBACK da Migration 174 — NÃO USAR sem antes corrigir a arquitetura
-- ============================================================
-- A 174 reverteu a 173 porque a 173 quebrava change-role e criação de usuário
-- (os endpoints de admin rodam como `authenticated`, não service_role — ver o
-- cabeçalho da 174). Reverter a 174 = re-aplicar o REVOKE da 173 = re-quebrar
-- esses fluxos.
--
-- ⚠️ NÃO rodar este rollback enquanto os endpoints de admin usarem
-- `createAdminClient()` com cookies (que faz o @supabase/ssr usar o JWT do
-- usuário). A proteção contra auto-escalada já é garantida pelo trigger da
-- mig 171, sem necessidade do REVOKE.
--
-- Mantido como no-op proposital. Se um dia a camada de GRANT for re-tentada,
-- faça-o numa migration NOVA, depois de migrar os endpoints para um client
-- service_role de verdade.
-- ============================================================

-- (no-op proposital — ver aviso acima)
SELECT 1;
