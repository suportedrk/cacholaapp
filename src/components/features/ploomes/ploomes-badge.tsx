import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  url?: string | null
  className?: string
  size?: 'sm' | 'xs'
}

export function PloomeBadge({ url, className, size = 'sm' }: Props) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        'badge-blue border',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        className,
      )}
    >
      <span className="text-[8px] font-bold tracking-wider uppercase leading-none">P</span>
      Ploomes
      {url && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
    </span>
  )

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title="Ver no Ploomes CRM">
        {content}
      </a>
    )
  }

  return content
}
