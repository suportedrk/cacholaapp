import type { LucideIcon } from 'lucide-react'
import { Clock } from 'lucide-react'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  phase?: string
}

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  phase = 'Em breve',
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Ícone principal */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center">
          <Icon className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center">
          <Clock className="w-4 h-4 text-primary" />
        </div>
      </div>

      {/* Badge de fase */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-4">
        <Clock className="w-3 h-3" />
        {phase}
      </span>

      {/* Título e descrição */}
      <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-3">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        {description}
      </p>

      <p className="mt-6 text-xs text-muted-foreground/60">
        Este módulo está sendo desenvolvido e estará disponível em breve.
      </p>
    </div>
  )
}
