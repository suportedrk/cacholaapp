import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useToggleActionItemStatus } from '@/hooks/use-meeting-minute-mutations'
import type { MeetingMinuteActionItemDetail } from '@/types/minutes'

interface ActionItemCheckRowProps {
  item:          MeetingMinuteActionItemDetail
  meetingId:     string
  canToggle:     boolean
}

export function ActionItemCheckRow({ item, meetingId, canToggle }: ActionItemCheckRowProps) {
  const toggle       = useToggleActionItemStatus()
  const isPending    = toggle.isPending && toggle.variables?.actionItemId === item.id
  const isDone       = item.status === 'done'

  const isOverdue =
    !isDone &&
    !!item.due_date &&
    new Date(item.due_date) < new Date(new Date().toDateString())

  function handleChange() {
    if (!canToggle || isPending) return
    toggle.mutate({
      actionItemId: item.id,
      meetingId,
      newStatus: isDone ? 'pending' : 'done',
    })
  }

  return (
    <div className="flex items-start gap-3 py-2">
      {/* Checkbox / spinner */}
      <div className="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center">
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <input
            type="checkbox"
            checked={isDone}
            onChange={handleChange}
            disabled={!canToggle}
            className={cn(
              'w-4 h-4 rounded border-border-default accent-primary',
              !canToggle && 'cursor-not-allowed opacity-50'
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm leading-snug',
            isDone && 'line-through text-muted-foreground'
          )}
        >
          {item.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {item.due_date && (
            <span
              className={cn(
                'text-xs',
                isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
              )}
            >
              Vence{isOverdue ? 'u' : ''}: {new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          )}

          {item.assignee && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserAvatar
                name={item.assignee.name}
                avatarUrl={item.assignee.avatar_url}
                size="sm"
                className="w-4 h-4 text-[10px]"
              />
              {item.assignee.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
