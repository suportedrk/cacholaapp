import { ActionItemCheckRow } from './ActionItemCheckRow'
import type { MeetingMinuteActionItemDetail } from '@/types/minutes'

interface ActionItemsChecklistProps {
  items:         MeetingMinuteActionItemDetail[]
  meetingId:     string
  currentUserId: string
  canToggleAll:  boolean  // true if elevated or creator
}

export function ActionItemsChecklist({
  items,
  meetingId,
  currentUserId,
  canToggleAll,
}: ActionItemsChecklistProps) {
  const doneCount = items.filter((a) => a.status === 'done').length

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum item de ação registrado.</p>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-3">
        {doneCount} de {items.length} {items.length === 1 ? 'item concluído' : 'itens concluídos'}
      </p>
      <div className="divide-y divide-border-default">
        {items.map((item) => {
          const canToggle = canToggleAll || item.assigned_to === currentUserId
          return (
            <ActionItemCheckRow
              key={item.id}
              item={item}
              meetingId={meetingId}
              canToggle={canToggle}
            />
          )
        })}
      </div>
    </div>
  )
}
