'use client'

import { useRef, useState } from 'react'
import { Camera, RefreshCw, Receipt, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/components/shared/photo-upload'
import { cn } from '@/lib/utils'
import { StatusBottomSheet } from './status-bottom-sheet'
import { QuickCostSheet }    from './quick-cost-sheet'
import {
  useChangeMaintenanceStatus,
  useCompleteMaintenanceOrder,
  useAddMaintenancePhoto,
} from '@/hooks/use-maintenance'
import type { MaintenanceStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS BAR
// Fixed bottom bar — shown only on mobile (md:hidden)
// ─────────────────────────────────────────────────────────────
interface Props {
  orderId:       string
  currentStatus: MaintenanceStatus
  canComplete:   boolean
}

export function QuickActionsBar({ orderId, currentStatus, canComplete }: Props) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [costOpen,   setCostOpen]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const changeStatus  = useChangeMaintenanceStatus()
  const completeOrder = useCompleteMaintenanceOrder()
  const addPhoto      = useAddMaintenancePhoto()

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Não autenticado'); return }

      const compressed = await compressImage(file, 1200, 0.8)
      const path = `${orderId}/quick-${Date.now()}.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('maintenance-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
      if (uploadErr) throw uploadErr

      await addPhoto.mutateAsync({
        orderId,
        url:        path,
        type:       'during',
        uploadedBy: user.id,
      })
      toast.success('Foto adicionada!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao enviar foto.')
    } finally {
      setUploading(false)
    }
  }

  function handleStatusSelect(status: MaintenanceStatus) {
    if (status === 'completed') {
      completeOrder.mutate(orderId)
    } else {
      changeStatus.mutate({ id: orderId, status })
    }
  }

  return (
    <>
      {/* Hidden camera input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Bar — mobile only */}
      <div
        className={cn(
          'md:hidden',
          'fixed bottom-0 left-0 right-0 z-[var(--z-sticky,20)]',
          'bg-card border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]',
          'flex items-center gap-2 px-4',
        )}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))', paddingTop: '12px' }}
      >
        {/* Foto */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1',
            'h-12 rounded-xl border border-border bg-muted/40',
            'text-xs font-medium text-muted-foreground',
            'hover:bg-muted hover:text-foreground active:scale-95',
            'transition-all disabled:opacity-50',
          )}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
          <span>{uploading ? 'Enviando...' : 'Foto'}</span>
        </button>

        {/* Status */}
        {canComplete && (
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1',
              'h-12 rounded-xl border border-primary/30 bg-primary/5',
              'text-xs font-medium text-primary',
              'hover:bg-primary/10 active:scale-95',
              'transition-all',
            )}
          >
            <RefreshCw className="w-5 h-5" />
            <span>Status</span>
          </button>
        )}

        {/* Custo */}
        <button
          type="button"
          onClick={() => setCostOpen(true)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1',
            'h-12 rounded-xl border border-border bg-muted/40',
            'text-xs font-medium text-muted-foreground',
            'hover:bg-muted hover:text-foreground active:scale-95',
            'transition-all',
          )}
        >
          <Receipt className="w-5 h-5" />
          <span>Custo</span>
        </button>
      </div>

      {/* Bottom sheets */}
      <StatusBottomSheet
        open={statusOpen}
        onOpenChange={setStatusOpen}
        currentStatus={currentStatus}
        onSelect={handleStatusSelect}
      />
      <QuickCostSheet
        open={costOpen}
        onOpenChange={setCostOpen}
        orderId={orderId}
      />
    </>
  )
}
