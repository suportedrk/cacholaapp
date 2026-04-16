'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Clock, Phone, FileText, Shield, Pencil, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { PreReservaModal } from './pre-reserva-modal'
import { useDeletePreReserva } from '@/hooks/use-pre-reserva-mutations'
import type { CalendarPreReserva } from '@/types/pre-reservas'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

interface PreReservaDetailModalProps {
  item:        CalendarPreReserva | null
  onClose:     () => void
  canManage:   boolean  // super_admin ou diretor
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export function PreReservaDetailModal({
  item,
  onClose,
  canManage,
}: PreReservaDetailModalProps) {
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const deleteMutation = useDeletePreReserva()

  async function handleDelete() {
    if (!item) return
    try {
      await deleteMutation.mutateAsync(item.id)
      setShowDelete(false)
      onClose()
    } catch {
      // toast já disparado no hook
    }
  }

  // Formatar data
  function formatDate(dateStr: string) {
    try {
      return format(new Date(`${dateStr}T00:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  // Formatar contato para WhatsApp (só números)
  function buildWaLink(contact: string) {
    const digits = contact.replace(/\D/g, '')
    if (digits.length >= 10) return `https://wa.me/55${digits}`
    return null
  }

  return (
    <>
      <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85dvh] overflow-y-auto sm:max-w-sm sm:rounded-xl"
        >
          {item && (
            <>
              <SheetHeader className="pb-0">
                <div className="flex items-start gap-2 pr-8">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/10 shrink-0">
                      <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <SheetTitle className="text-base font-semibold leading-tight truncate">
                      {item.title}
                    </SheetTitle>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mt-0.5">
                    Pré-venda
                  </span>
                </div>
              </SheetHeader>

              <div className="px-4 py-3 space-y-2.5">
                {/* Data */}
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="capitalize">{formatDate(item.date)}</span>
                </div>

                {/* Horário */}
                {(item.start_time || item.end_time) && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      {item.start_time ?? '—'}
                      {item.end_time && ` → ${item.end_time}`}
                    </span>
                  </div>
                )}

                {/* Contato */}
                {item.client_contact && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    {buildWaLink(item.client_contact) ? (
                      <a
                        href={buildWaLink(item.client_contact)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        {item.client_contact}
                      </a>
                    ) : (
                      <span>{item.client_contact}</span>
                    )}
                  </div>
                )}

                {/* Observação */}
                {item.description && (
                  <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="whitespace-pre-wrap">{item.description}</p>
                  </div>
                )}
              </div>

              {canManage && (
                <SheetFooter className="px-4 pb-4 gap-2 flex-row">
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => setShowEdit(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-1.5"
                    onClick={() => setShowDelete(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal de edição */}
      {item && (
        <PreReservaModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          unitId={item.unit_id}
          editItem={item}
        />
      )}

      {/* Confirmação de exclusão */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir pré-reserva?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A pré-reserva de{' '}
              <strong>{item?.title}</strong> será removida permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
