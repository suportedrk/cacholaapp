'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X, Image as ImageIcon, MessageCircle, PenLine, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { generateChecklistReportPDF } from '@/lib/utils/checklist-report-pdf'
import {
  PRIORITY_LABELS, CHECKLIST_TYPE_LABELS,
} from '@/types/database.types'
import type { ChecklistWithItems } from '@/types/database.types'
import type { RichChecklistItem } from './checklist-item-row'
import type {
  ChecklistReportItem,
  ChecklistReportPhoto,
  ChecklistReportCommentGroup,
} from '@/lib/utils/checklist-report-pdf'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function resizeImageForPdf(
  url: string,
  maxW = 1200,
  maxH = 900,
): Promise<{ dataUrl: string; aspectRatio: number } | null> {
  return new Promise((resolve) => {
    // eslint-disable-next-line no-restricted-globals
    const img = new globalThis.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      const ar = w / h
      if (w > maxW) { w = maxW; h = Math.round(w / ar) }
      if (h > maxH) { h = maxH; w = Math.round(h * ar) }
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), aspectRatio: ar })
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface ExportPdfModalProps {
  open:      boolean
  onClose:   () => void
  checklist: ChecklistWithItems
}

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────

export function ExportPdfModal({ open, onClose, checklist }: ExportPdfModalProps) {
  const activeUnit = useUnitStore((s) => s.activeUnit)

  const [includePhotos,     setIncludePhotos]     = useState(true)
  const [includeComments,   setIncludeComments]   = useState(true)
  const [includeSignatures, setIncludeSignatures] = useState(true)

  const [status, setStatus] = useState<'idle' | 'generating'>('idle')
  const [progress, setProgress] = useState('')

  const handleGenerate = useCallback(async () => {
    setStatus('generating')
    try {
      const supabase = createClient()
      const items    = checklist.checklist_items as RichChecklistItem[]

      // ── 1. Build report items ──────────────────────────────
      const reportItems: ChecklistReportItem[] = items.map((item, i) => ({
        index:           i + 1,
        description:     item.description,
        status:          item.status,
        priorityLabel:   item.priority && item.priority !== 'medium'
                           ? PRIORITY_LABELS[item.priority]
                           : null,
        responsibleName: item.assigned_user?.name ?? item.done_by_user?.name ?? null,
        estimatedMin:    item.estimated_minutes ?? null,
        notes:           item.notes ?? null,
      }))

      // ── 2. Fetch signed URLs + resize photos ───────────────
      const reportPhotos: ChecklistReportPhoto[] = []
      if (includePhotos) {
        const photoPaths = items
          .filter((i) => i.photo_url)
          .map((i) => i.photo_url!)

        if (photoPaths.length > 0) {
          const { data: signed } = await supabase.storage
            .from('checklist-photos')
            .createSignedUrls(photoPaths, 60 * 60)

          const signedMap = new Map(
            (signed ?? []).map((s) => [s.path, s.signedUrl]),
          )

          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (!item.photo_url) continue
            const signedUrl = signedMap.get(item.photo_url)
            if (!signedUrl) continue

            setProgress(`Processando foto ${reportPhotos.length + 1} de ${photoPaths.length}…`)
            const resized = await resizeImageForPdf(signedUrl)
            if (resized) {
              reportPhotos.push({
                itemDescription: item.description,
                dataUrl:         resized.dataUrl,
                aspectRatio:     resized.aspectRatio,
                takenAt:         item.created_at ?? null,
                takenBy:         item.done_by_user?.name ?? null,
              })
            }
          }
        }
      }

      // ── 3. Fetch comments ──────────────────────────────────
      const commentGroups: ChecklistReportCommentGroup[] = []
      if (includeComments) {
        setProgress('Carregando comentários…')
        const itemIds = items.map((i) => i.id)
        const { data: comments } = await supabase
          .from('checklist_item_comments')
          .select('item_id, content, created_at, user_id, users!checklist_item_comments_user_id_fkey(name)')
          .in('item_id', itemIds)
          .order('created_at', { ascending: true })

        if (comments && comments.length > 0) {
          // group by item
          const byItem = new Map<string, typeof comments>()
          for (const c of comments) {
            const arr = byItem.get(c.item_id) ?? []
            arr.push(c)
            byItem.set(c.item_id, arr)
          }
          for (const item of items) {
            const entries = byItem.get(item.id)
            if (!entries || entries.length === 0) continue
            commentGroups.push({
              itemDescription: item.description,
              entries: entries.map((e) => ({
                author:    ((e as unknown as { users: { name: string } | null }).users)?.name ?? 'Usuário',
                content:   e.content,
                createdAt: e.created_at,
              })),
            })
          }
        }
      }

      // ── 4. Generate PDF ────────────────────────────────────
      setProgress('Gerando PDF…')
      const slug = checklist.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)

      await generateChecklistReportPDF({
        unitName:          activeUnit?.name ?? 'Cachola OS',
        accentHex:         '#7C8D78',
        checklistTitle:    checklist.title,
        checklistType:     CHECKLIST_TYPE_LABELS[checklist.type ?? 'standalone'],
        priorityLabel:     checklist.priority && checklist.priority !== 'medium'
                             ? PRIORITY_LABELS[checklist.priority]
                             : null,
        eventTitle:        checklist.event?.title ?? null,
        eventDate:         checklist.event?.date ?? null,
        responsibleName:   (checklist as ChecklistWithItems & { assigned_user?: { name: string } | null })
                             .assigned_user?.name ?? null,
        createdAt:         checklist.created_at ?? null,
        completedAt:       checklist.completed_at ?? null,
        completedByName:   (checklist as ChecklistWithItems & { completed_by_user?: { name: string } | null })
                             .completed_by_user?.name ?? null,
        doneCount:         items.filter((i) => i.status === 'done').length,
        totalCount:        items.length,
        totalEstimatedMin: items.reduce((s, i) => s + (i.estimated_minutes ?? 0), 0),
        items:             reportItems,
        photos:            reportPhotos,
        commentGroups,
        includePhotos,
        includeComments,
        includeSignatures,
        filename:          `checklist-${slug}`,
      })

      onClose()
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      setProgress('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setStatus('idle')
      setProgress('')
    }
  }, [
    checklist, activeUnit,
    includePhotos, includeComments, includeSignatures,
    onClose,
  ])

  if (!open) return null

  const isGenerating = status === 'generating'
  const hasPhotos    = (checklist.checklist_items as RichChecklistItem[]).some((i) => i.photo_url)

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[48] bg-black/50 backdrop-blur-sm"
        onClick={() => { if (!isGenerating) onClose() }}
      />

      {/* Panel */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[49] sm:inset-auto sm:top-1/2 sm:-translate-x-1/2 sm:left-1/2 sm:-translate-y-1/2 sm:w-[420px] animate-scale-in">
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Exportar PDF</h2>
                <p className="text-xs text-muted-foreground">Relatório completo do checklist</p>
              </div>
            </div>
            <button
              onClick={() => { if (!isGenerating) onClose() }}
              disabled={isGenerating}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-border/60" />

          {/* Options */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Incluir no relatório
            </p>

            <ToggleOption
              icon={<ImageIcon className="w-4 h-4" />}
              label="Evidências fotográficas"
              description={hasPhotos ? 'Fotos dos itens do checklist' : 'Nenhuma foto registrada'}
              checked={includePhotos && hasPhotos}
              disabled={!hasPhotos || isGenerating}
              onChange={setIncludePhotos}
            />

            <ToggleOption
              icon={<MessageCircle className="w-4 h-4" />}
              label="Observações e comentários"
              description="Comentários dos itens"
              checked={includeComments}
              disabled={isGenerating}
              onChange={setIncludeComments}
            />

            <ToggleOption
              icon={<PenLine className="w-4 h-4" />}
              label="Área de assinaturas"
              description="Campos para responsável e supervisor"
              checked={includeSignatures}
              disabled={isGenerating}
              onChange={setIncludeSignatures}
            />
          </div>

          {/* Progress */}
          {progress && (
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground animate-pulse">{progress}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border/60 px-5 py-4 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { if (!isGenerating) onClose() }}
              disabled={isGenerating}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando…
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Gerar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────
// TOGGLE OPTION
// ─────────────────────────────────────────────────────────────

interface ToggleOptionProps {
  icon:        React.ReactNode
  label:       string
  description: string
  checked:     boolean
  disabled:    boolean
  onChange:    (v: boolean) => void
}

function ToggleOption({ icon, label, description, checked, disabled, onChange }: ToggleOptionProps) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
      disabled
        ? 'border-border/40 opacity-50 cursor-not-allowed'
        : checked
          ? 'border-primary/30 bg-primary/5'
          : 'border-border hover:border-border-strong'
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        checked && !disabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary shrink-0"
      />
    </label>
  )
}
