-- Migration 161 - Nome do responsavel pela decoracao no evento (vindo do Ploomes).
-- Padrao esteira: sem BEGIN/COMMIT/ROLLBACK nem NOTIFY pgrst (a esteira gerencia a transacao e recarrega o schema apos o commit).
-- Adiciona decorator_name em events. Espelha o campo de DEAL "Responsavel da decoracao?" (FieldKey deal_704AFDA8-03B8-4399-9BD7-D945EE3EF2A8), um select no Ploomes lido via ObjectValueName. Nullable: nao obrigatorio no Ploomes (~42% preenchido). Sem indice: coluna textual exibida no card, sem uso em filtro/join. Nao altera RLS (atributo do evento, ja coberto pelas policies existentes de events).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS decorator_name text;

COMMENT ON COLUMN public.events.decorator_name IS
  'Nome do responsavel pela decoracao, espelhado do campo de DEAL "Responsavel da decoracao?" do Ploomes (select, lido via ObjectValueName). Nullable: nao obrigatorio no Ploomes. Introduzida na migration 161.';
