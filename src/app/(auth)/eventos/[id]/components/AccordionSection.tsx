'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AccordionSectionProps {
  title: string
  icon: React.ElementType
  badge?: string | number
  defaultOpen?: boolean
  children: React.ReactNode
}

export function AccordionSection({ title, icon: Icon, badge, defaultOpen = false, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <Icon className="w-4 h-4 text-text-secondary shrink-0" />
        <span className="text-sm font-medium text-text-primary flex-1">{title}</span>
        {badge !== undefined && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-text-secondary text-xs font-medium">
            {badge}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-text-tertiary transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
