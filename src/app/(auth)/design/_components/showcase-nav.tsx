'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ShowcaseSectionRef {
  id: string
  label: string
}

/**
 * Nav de âncoras da vitrine. Sticky no desktop (`aside`) com scrollspy via
 * IntersectionObserver; no mobile a `page.tsx` renderiza uma barra horizontal.
 */
export function ShowcaseNav({ sections }: { sections: ShowcaseSectionRef[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Seções do design system">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={cn(
            'focus-ring rounded-md px-3 py-1.5 text-sm transition-colors',
            active === s.id
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {s.label}
        </a>
      ))}
    </nav>
  )
}
