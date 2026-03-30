'use client'

import { useRouter } from 'next/navigation'
import { Phone, MessageCircle, Pencil, MoreVertical } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useUpdateProvider, useDeleteProvider } from '@/hooks/use-providers'
import type { ServiceProviderWithDetails } from '@/types/providers'

interface Props {
  provider: ServiceProviderWithDetails
}

function getWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}`
}

export function ProviderQuickActions({ provider }: Props) {
  const router = useRouter()
  const updateProvider = useUpdateProvider()
  const deleteProvider = useDeleteProvider()

  const phoneContact = provider.contacts.find((c) => c.type === 'phone' || c.type === 'whatsapp')
  const waContact = provider.contacts.find((c) => c.type === 'whatsapp') ?? phoneContact
  const primaryContact = provider.contacts.find((c) => c.is_primary) ?? provider.contacts[0]

  const telHref = primaryContact
    ? `tel:${primaryContact.value.replace(/\D/g, '')}`
    : null
  const waUrl = waContact ? getWhatsAppUrl(waContact.value) : null

  function handleToggleStatus() {
    const newStatus = provider.status === 'active' ? 'inactive' : 'active'
    updateProvider.mutate({ id: provider.id, status: newStatus })
  }

  async function handleDelete() {
    await deleteProvider.mutateAsync(provider.id)
    router.push('/prestadores')
  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 md:hidden z-[25] bg-card border-t border-border"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        {/* Ligar */}
        {telHref ? (
          <a
            href={telHref}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Phone className="w-5 h-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Ligar</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg opacity-40"
          >
            <Phone className="w-5 h-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Ligar</span>
          </button>
        )}

        {/* WhatsApp */}
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">WhatsApp</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg opacity-40"
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">WhatsApp</span>
          </button>
        )}

        {/* Editar */}
        <button
          type="button"
          onClick={() => router.push(`/prestadores/${provider.id}/editar`)}
          className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <Pencil className="w-5 h-5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Editar</span>
        </button>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Mais</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-44 mb-2">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleToggleStatus}>
                {provider.status === 'active' ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
              {provider.status !== 'blocked' && (
                <DropdownMenuItem
                  onClick={() => updateProvider.mutate({ id: provider.id, status: 'blocked' })}
                  className="text-destructive focus:text-destructive"
                >
                  Bloquear
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Excluir prestador?"
              description={`Tem certeza que deseja excluir "${provider.name}"?`}
              destructive
              onConfirm={handleDelete}
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  Excluir
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
