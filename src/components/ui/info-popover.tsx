'use client'

import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface InfoPopoverProps {
  children:   React.ReactNode
  ariaLabel?: string
}

export function InfoPopover({
  children,
  ariaLabel = 'Informações sobre esta seção',
}: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-text-tertiary hover:text-text-secondary transition-colors focus-ring"
      >
        <Info className="w-4 h-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[380px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
