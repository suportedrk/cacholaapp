'use client'

import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateInputProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
  id?: string
}

/**
 * Styled date input that matches the design system.
 * Wraps <input type="date"> with a custom Calendar icon,
 * hiding the native browser picker icon via CSS.
 */
export function DateInput({ value, onChange, className, id }: DateInputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          // Match Input component base styles
          'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs',
          'text-foreground placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'hover:border-border-strong transition-colors',
          // Leave room for the calendar icon
          'pr-8',
          // Hide native calendar picker indicator (WebKit/Blink)
          '[&::-webkit-calendar-picker-indicator]:opacity-0',
          '[&::-webkit-calendar-picker-indicator]:absolute',
          '[&::-webkit-calendar-picker-indicator]:right-0',
          '[&::-webkit-calendar-picker-indicator]:w-8',
          '[&::-webkit-calendar-picker-indicator]:h-full',
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
          className,
        )}
      />
      <Calendar className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
    </div>
  )
}
