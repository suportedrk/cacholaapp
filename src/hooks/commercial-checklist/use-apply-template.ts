'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { commercialTasksKeys } from './use-commercial-tasks'

export interface ApplyTemplateInput {
  templateId:  string
  assigneeId:  string
  baseDate:    string   // ISO date string 'YYYY-MM-DD'
}

export function useApplyCommercialTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ templateId, assigneeId, baseDate }: ApplyTemplateInput) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('apply_commercial_template', {
        p_template_id:  templateId,
        p_assignee_id:  assigneeId,
        p_base_date:    baseDate,
      })
      if (error) throw error
      return data as number  // número de tasks criadas
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTasksKeys.all })
    },
  })
}
