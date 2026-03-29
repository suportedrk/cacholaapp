'use client'

import { useUnitBrand } from '@/hooks/use-unit-settings'

interface UnitAccentWrapperProps {
  children: React.ReactNode
}

/**
 * Applies the active unit's accent color as a CSS variable override.
 * All Tailwind utilities that reference --primary (bg-primary, text-primary, etc.)
 * automatically pick up this override via cascade.
 */
export function UnitAccentWrapper({ children }: UnitAccentWrapperProps) {
  const { accentColor } = useUnitBrand()

  return (
    <div
      style={{ '--primary': accentColor } as React.CSSProperties}
      className="contents transition-colors duration-300"
    >
      {children}
    </div>
  )
}
