-- ============================================================
-- Migration 095: Trigger de guarda da aprovacao de custo (Fase 3.5)
-- ============================================================
-- Fecha a segunda "porta dos fundos" do modulo de Manutencao (§4.2.4).
--
-- PROBLEMA: a aprovacao de custo de uma execucao mora em 3 colunas de
-- maintenance_executions -- cost_approved / cost_approved_by /
-- cost_approved_at. O app aprova via UPDATE direto do cliente
-- (useApproveCost em src/hooks/use-tickets.ts), como o usuario
-- autenticado. A RLS de UPDATE da migration 094
-- ("maintenance_executions: edit") so checa check_permission(...,'edit')
-- -- e NAO distingue QUAL coluna esta sendo alterada. Um tecnico
-- (role 'manutencao') tem 'edit', logo passaria na RLS e conseguiria
-- "UPDATE maintenance_executions SET cost_approved = true" via
-- PostgREST direto. A aprovacao de custo deve ser exclusiva dos cargos
-- de gestao (MAINTENANCE_ADMIN_ROLES: super_admin / diretor / gerente).
--
-- SOLUCAO: trigger BEFORE UPDATE que dispara quando QUALQUER das 3
-- colunas de aprovacao muda (comparacao de tupla IS DISTINCT FROM --
-- pega aprovar, desaprovar e spoof isolado de _by/_at) e exige que o
-- ator (auth.uid()) seja super_admin, diretor ou gerente.
--
-- INVESTIGACAO (Passo A -- 2026-05-22):
--  * As 3 colunas de aprovacao existem SO em maintenance_executions.
--    A tabela legada maintenance_costs (que tinha seu proprio workflow
--    status/reviewed_by) foi DROPada pela migration 032 -- nao existe
--    outra tabela/coluna de aprovacao.
--  * Unico escritor das colunas: useApproveCost (sessao do usuario).
--    NENHUM processo nao-usuario (service_role/createAdminClient, cron,
--    sync, outro trigger) escreve essas colunas. Os 2 triggers
--    existentes em maintenance_executions (maintenance_executions_
--    updated_at, sync_ticket_total_cost) nao tocam as colunas de
--    aprovacao. => o trigger exige cargo admin e NAO tem "passe" de
--    service_role -- nada legitimo precisa dele hoje.
--  * Identificacao de admin: padrao canonico do projeto
--    (cachola-rbac-pattern, patterns-by-layer §6) -- subquery em
--    public.users com role IN (...), dentro de funcao SECURITY DEFINER.
--    Sem helper dedicado: o conjunto super_admin/diretor/gerente nao
--    coincide com is_super_admin() nem is_global_viewer(); como o uso
--    e unico (so este trigger), a checagem fica inline (regra CLAUDE.md
--    "nao criar helper para uso unico").
--
-- NOTA OPERACIONAL: se uma migration futura precisar editar em massa
-- as colunas de aprovacao (backfill, correcao), desativar o trigger
-- na janela:
--   ALTER TABLE public.maintenance_executions DISABLE TRIGGER trg_guard_cost_approval;
--   ...  UPDATE ...
--   ALTER TABLE public.maintenance_executions ENABLE  TRIGGER trg_guard_cost_approval;
--
-- Idempotente: DROP TRIGGER/FUNCTION IF EXISTS antes do CREATE.
-- ============================================================

BEGIN;

DROP TRIGGER  IF EXISTS trg_guard_cost_approval ON public.maintenance_executions;
DROP FUNCTION IF EXISTS public.guard_cost_approval();

CREATE FUNCTION public.guard_cost_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dispara apenas quando alguma das 3 colunas de aprovacao muda.
  -- Comparacao de tupla com IS DISTINCT FROM -> NULL-safe; cobre
  -- aprovar (false->true), desaprovar (true->false) e a alteracao
  -- isolada de cost_approved_by / cost_approved_at (anti-spoofing).
  IF (NEW.cost_approved, NEW.cost_approved_by, NEW.cost_approved_at)
     IS DISTINCT FROM
     (OLD.cost_approved, OLD.cost_approved_by, OLD.cost_approved_at)
  THEN
    -- Ator precisa ser cargo de gestao de manutencao.
    -- SECURITY DEFINER permite ler public.users sem esbarrar na RLS.
    -- auth.uid() NULL (postgres/service_role/sem JWT) -> EXISTS falso
    -- -> bloqueado; nenhum processo nao-usuario escreve essas colunas.
    -- NOTA: a lista abaixo espelha MAINTENANCE_ADMIN_ROLES em
    -- src/config/roles.ts (['super_admin','diretor','gerente']).
    -- SQL nao le o TypeScript: manter em sincronia manualmente se a
    -- constante mudar (ex.: ao adicionar uma role ao conjunto admin de manutencao).
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    ) THEN
      RAISE EXCEPTION
        'permissao_negada: aprovacao de custo restrita a super_admin, diretor ou gerente'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_cost_approval() IS
  'Trigger BEFORE UPDATE de maintenance_executions: bloqueia alteracao das '
  'colunas cost_approved/_by/_at por quem nao for super_admin/diretor/gerente. '
  'Fecha a porta dos fundos §4.2.4 (a RLS de edit da 094 nao distingue colunas).';

CREATE TRIGGER trg_guard_cost_approval
  BEFORE UPDATE ON public.maintenance_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_cost_approval();

COMMIT;
