import { ClipboardList } from 'lucide-react'
import { PlaceholderPage } from '@/components/shared/placeholder-page'

export default function ChecklistsPage() {
  return (
    <PlaceholderPage
      icon={ClipboardList}
      title="Checklists"
      description="Crie e gerencie checklists de eventos, manutenção e operação. Use templates reutilizáveis."
      phase="Fase 1"
    />
  )
}
