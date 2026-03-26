'use client'

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  count?: number
}

export function NotificationBell({ count = 0 }: NotificationBellProps) {
  return (
    <button
      className={cn(
        'relative p-2 rounded-lg text-muted-foreground',
        'hover:bg-accent hover:text-foreground',
        'transition-colors duration-150',
        'min-h-[44px] min-w-[44px] flex items-center justify-center'
      )}
      aria-label={count > 0 ? `${count} notificações não lidas` : 'Notificações'}
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span
          className="absolute top-1.5 right-1.5 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-white flex items-center justify-center"
          aria-hidden="true"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
