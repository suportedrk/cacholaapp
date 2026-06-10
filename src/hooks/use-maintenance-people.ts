'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface MaintenancePerson {
  id: string
  name: string
  avatar_url: string | null
}

export type MaintenancePeopleMap = Map<string, { name: string; avatar_url: string | null }>

/**
 * Resolve NOMES de usuários exibidos no módulo Manutenção (responsável pelo chamado,
 * solicitante, executor interno, aprovador de custo, autor de mudança de status, etc.).
 *
 * Necessário porque a RLS de public.users só deixa super_admin/diretor verem OUTROS
 * usuários — qualquer outro cargo (técnico de manutenção incluso) só vê a própria linha,
 * e por isso os embeds PostgREST de users voltam NULL. O RPC get_maintenance_people é
 * SECURITY DEFINER read-only, gated por manutencao 'view', e reimpõe o escopo de privacidade:
 * só usuários que aparecem em chamados das unidades acessíveis ao chamador.
 *
 * Devolve um Map<id, {name, avatar_url}> para lookup direto por id na UI.
 *
 * @param unitId Unidade do chamado (null/undefined = unidades acessíveis do chamador).
 */
export function useMaintenancePeople(unitId: string | null | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-people', unitId ?? null],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async (): Promise<MaintenancePeopleMap> => {
      const supabase = createClient()
      // RPC fora do database.types.ts gerado — cast no padrão do projeto (igual aos
      // hooks de BI/lead-origin) para chamar funções ainda não tipadas.
      const { data, error } = await (supabase as any).rpc('get_maintenance_people', {
        p_unit_id: unitId ?? undefined,
      })
      if (error) throw error

      const map: MaintenancePeopleMap = new Map()
      for (const row of (data ?? []) as MaintenancePerson[]) {
        map.set(row.id, { name: row.name, avatar_url: row.avatar_url })
      }
      return map
    },
  })
}
