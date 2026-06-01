'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/components/shared/photo-upload'
import { PhotoLightbox } from '@/components/shared/photo-lightbox'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useFestaFotos, useAddFestaFoto, useRemoveFestaFoto, useUpdateFestaFotoLegenda } from '@/hooks/use-decoracao'
import { DECORACAO_BUCKETS } from '@/lib/constants'

// ── Tipos ─────────────────────────────────────────────────────

interface FestaFotosGaleriaProps {
  festaDecoracaoId: string
  /** Quando encerrada, a galeria é somente-leitura. */
  isEncerrada: boolean
  /** Só usuários com 'edit' podem subir/remover. A prop vem do componente-pai. */
  canEdit: boolean
}

interface UploadItem {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMsg?: string
}

// ── Multi-upload interno ───────────────────────────────────────
// Usa <input multiple> + compressImage (de photo-upload.tsx).
// Uploads acontecem em paralelo (fire-and-await por arquivo).
// NÃO modifica o PhotoDropZone existente — lógica isolada neste componente.

const FESTA_BUCKET = DECORACAO_BUCKETS.festa

export function FestaFotosGaleria({
  festaDecoracaoId,
  isEncerrada,
  canEdit,
}: FestaFotosGaleriaProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: fotos = [], isLoading } = useFestaFotos(festaDecoracaoId)
  const addFoto   = useAddFestaFoto()
  const removeFoto = useRemoveFestaFoto()
  const updateLegenda = useUpdateFestaFotoLegenda()

  // Signed URLs para todas as fotos da galeria (batch, cache 30 min)
  const paths = fotos.map((f) => f.foto_path)
  const { data: signedUrls = {} } = useSignedUrls(FESTA_BUCKET, paths)

  // Fila de uploads em progresso
  const [uploads, setUploads] = useState<UploadItem[]>([])

  // Lightbox
  const [lightboxOpen, setLightboxOpen]   = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Legenda inline (id da foto sendo editada)
  const [editingLegendaId, setEditingLegendaId] = useState<string | null>(null)
  const [legendaDraft, setLegendaDraft]         = useState('')
  const legendaInputRef = useRef<HTMLInputElement>(null)

  // Ao abrir o input de legenda, focar automaticamente
  useEffect(() => {
    if (editingLegendaId) {
      setTimeout(() => legendaInputRef.current?.focus(), 50)
    }
  }, [editingLegendaId])

  // ── Handlers de upload ───────────────────────────────────────

  function openFilePicker() {
    inputRef.current?.click()
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    e.target.value = '' // reseta para permitir re-seleção do mesmo arquivo

    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending',
    }))

    setUploads((prev) => [...prev, ...newItems])

    // Upload em paralelo (cada arquivo independente)
    await Promise.all(newItems.map((item) => uploadOne(item)))
  }

  async function uploadOne(item: UploadItem) {
    updateUpload(item.id, { status: 'uploading', progress: 10 })

    try {
      const blob = await compressImage(item.file)
      updateUpload(item.id, { progress: 40 })

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const storagePath = `${festaDecoracaoId}/fotos/${fileName}`

      const supabase = createClient()
      const { error: uploadErr } = await supabase.storage
        .from(FESTA_BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })

      if (uploadErr) throw uploadErr
      updateUpload(item.id, { progress: 80 })

      // Persiste no banco via API
      await addFoto.mutateAsync({
        festaDecoracaoId,
        foto_path: storagePath,
        legenda: null,
        ordem: 0,
      })

      updateUpload(item.id, { status: 'done', progress: 100 })

      // Remove da fila após 1.5s
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== item.id))
      }, 1500)
    } catch (err) {
      updateUpload(item.id, {
        status: 'error',
        errorMsg: err instanceof Error ? err.message : 'Erro ao enviar',
      })
    }
  }

  function updateUpload(id: string, patch: Partial<UploadItem>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  function dismissUploadError(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  // ── Handlers de remoção ──────────────────────────────────────

  function handleRemove(fotoId: string) {
    removeFoto.mutate({ festaDecoracaoId, fotoId })
  }

  // ── Handlers de legenda inline ───────────────────────────────

  function startEditLegenda(fotoId: string, current: string | null) {
    setEditingLegendaId(fotoId)
    setLegendaDraft(current ?? '')
  }

  function saveLegenda() {
    if (!editingLegendaId) return
    updateLegenda.mutate({
      festaDecoracaoId,
      fotoId: editingLegendaId,
      legenda: legendaDraft.trim() || null,
    })
    setEditingLegendaId(null)
  }

  function cancelLegenda() {
    setEditingLegendaId(null)
    setLegendaDraft('')
  }

  // ── Fotos para o lightbox ────────────────────────────────────

  const lightboxPhotos = fotos
    .map((f) => ({
      id: f.id,
      signedUrl: signedUrls[f.foto_path] ?? '',
      label: f.legenda ?? undefined,
    }))
    .filter((p) => p.signedUrl)

  const canInteract = canEdit && !isEncerrada

  // ── Render ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando fotos…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Fila de progresso de upload */}
      {uploads.length > 0 && (
        <div className="space-y-1.5">
          {uploads.map((u) => (
            <div
              key={u.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                u.status === 'error'
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {u.status === 'uploading' || u.status === 'pending' ? (
                <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
              ) : u.status === 'done' ? (
                <span className="w-3 h-3 shrink-0 text-green-600">✓</span>
              ) : (
                <X className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate flex-1">{u.file.name}</span>
              {u.status === 'uploading' && (
                <span className="tabular-nums shrink-0">{u.progress}%</span>
              )}
              {u.status === 'error' && (
                <button
                  type="button"
                  onClick={() => dismissUploadError(u.id)}
                  className="shrink-0 hover:opacity-70"
                  aria-label="Fechar"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Grade de miniaturas */}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {fotos.map((foto, idx) => {
            const src = signedUrls[foto.foto_path]
            return (
              <div key={foto.id} className="space-y-1">
                {/* Miniatura */}
                <div className="relative rounded-lg overflow-hidden aspect-square bg-muted group">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={foto.legenda ?? `Foto ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-[1.03]"
                      onClick={() => {
                        const lightboxIdx = lightboxPhotos.findIndex((p) => p.id === foto.id)
                        if (lightboxIdx >= 0) {
                          setLightboxIndex(lightboxIdx)
                          setLightboxOpen(true)
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Botão remover */}
                  {canInteract && (
                    <button
                      type="button"
                      disabled={removeFoto.isPending}
                      onClick={() => handleRemove(foto.id)}
                      className={cn(
                        'absolute top-1.5 right-1.5 w-6 h-6 rounded-full',
                        'bg-black/60 text-white flex items-center justify-center',
                        'transition-colors hover:bg-red-500',
                        'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                      )}
                      aria-label="Remover foto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Legenda inline */}
                {editingLegendaId === foto.id ? (
                  <input
                    ref={legendaInputRef}
                    value={legendaDraft}
                    onChange={(e) => setLegendaDraft(e.target.value)}
                    onBlur={saveLegenda}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveLegenda() }
                      if (e.key === 'Escape') cancelLegenda()
                    }}
                    maxLength={120}
                    placeholder="Legenda…"
                    className="w-full text-[11px] bg-transparent border-0 border-b border-border focus:outline-none focus:border-primary px-0 py-0.5 text-foreground placeholder:text-muted-foreground/50"
                  />
                ) : (
                  <p
                    className={cn(
                      'text-[11px] leading-tight truncate',
                      canInteract
                        ? 'text-muted-foreground cursor-pointer hover:text-foreground transition-colors'
                        : 'text-muted-foreground/70',
                    )}
                    title={canInteract ? 'Clique para editar legenda' : (foto.legenda ?? undefined)}
                    onClick={() => canInteract && startEditLegenda(foto.id, foto.legenda)}
                  >
                    {foto.legenda ?? (canInteract ? (
                      <span className="italic text-muted-foreground/40">+ legenda</span>
                    ) : null)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Botão adicionar fotos */}
      {canInteract && (
        <>
          <button
            type="button"
            onClick={openFilePicker}
            className={cn(
              'w-full rounded-xl border-2 border-dashed border-border',
              'flex items-center justify-center gap-2 py-3 px-4',
              'text-sm text-muted-foreground',
              'hover:border-primary hover:text-primary hover:bg-[var(--color-brand-50)]',
              'dark:hover:bg-[oklch(0.260_0.040_144_/_0.08)]',
              'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Camera className="w-4 h-4" />
            {fotos.length === 0 ? 'Adicionar fotos da montagem' : 'Adicionar mais fotos'}
          </button>

          {/* Input oculto com multiple para seleção em lote */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={handleFilesSelected}
          />
        </>
      )}

      {/* Estado vazio quando encerrada */}
      {isEncerrada && fotos.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">
          Nenhuma foto registrada para esta festa.
        </p>
      )}

      {/* Lightbox */}
      <PhotoLightbox
        photos={lightboxPhotos}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </div>
  )
}
