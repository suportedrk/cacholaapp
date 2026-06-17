-- Migration 159 — cria a tabela de controle/auditoria da esteira de migracao.
-- Esta e a ULTIMA migracao aplicada manualmente (via PowerShell). A partir da 160, tudo passa pela esteira.
BEGIN;
CREATE TABLE IF NOT EXISTS public.cachola_migration_log (
  filename    text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  applied_by  text,
  git_sha     text,
  checksum    text
);
COMMENT ON TABLE public.cachola_migration_log IS 'Registro das migracoes aplicadas em producao pela esteira (GitHub Actions). Auditoria e guarda contra reaplicacao.';
ALTER TABLE public.cachola_migration_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cachola_migration_log FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
