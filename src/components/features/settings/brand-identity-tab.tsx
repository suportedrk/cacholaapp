'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, Palette, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitSettingsData, useUpdateUnitSettings, useUnitBrand } from '@/hooks/use-unit-settings'
import { compressImage } from '@/components/shared/photo-upload'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────
// Preset accent colors — harmonize with sage green
// ─────────────────────────────────────────────────────────────
const ACCENT_PRESETS = [
  { label: 'Verde Sálvia (padrão)', value: '#7C8D78' },
  { label: 'Verde Floresta',        value: '#4A7C59' },
  { label: 'Azul Ardósia',         value: '#4A6FA5' },
  { label: 'Azul Marinho',         value: '#2D5F8A' },
  { label: 'Terracota',            value: '#B5634A' },
  { label: 'Bordô',                value: '#8B3A62' },
  { label: 'Âmbar',                value: '#B07D2A' },
  { label: 'Cinza Chumbo',         value: '#5A6472' },
]

export function BrandIdentityTab() {
  const { activeUnitId } = useUnitStore()
  const settings    = useUnitSettingsData()
  const { accentColor, logoPath, displayName: savedDisplayName } = useUnitBrand()
  const updateSettings = useUpdateUnitSettings()

  // Local state
  const [selectedColor, setSelectedColor] = useState<string>(accentColor)
  const [customColor, setCustomColor]     = useState<string>(accentColor)
  const [displayName, setDisplayName]     = useState<string>(savedDisplayName ?? '')
  const [logoPreview, setLogoPreview]     = useState<string | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadedPath, setUploadedPath]   = useState<string | null>(logoPath)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasChanges =
    selectedColor !== accentColor ||
    displayName   !== (savedDisplayName ?? '') ||
    uploadedPath  !== logoPath

  // ── Logo upload ──────────────────────────────────────────
  async function handleLogoFile(file: File) {
    if (!activeUnitId) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo deve ter no máximo 2MB')
      return
    }

    // Preview imediato
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const blob = await compressImage(file, 400, 0.85)
      const compressed = new File([blob], 'logo.jpg', { type: 'image/jpeg' })
      const path = `unit-logos/${activeUnitId}/logo.jpg`

      const { error } = await createClient().storage
        .from('user-avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })

      if (error) throw error
      setUploadedPath(path)
      toast.success('Logo carregada com sucesso')
    } catch (err: unknown) {
      toast.error(`Erro ao fazer upload: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      setLogoPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveLogo() {
    setLogoPreview(null)
    setUploadedPath(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    await updateSettings.mutateAsync({
      ...settings,
      brand: {
        accent_color: selectedColor,
        logo_url:     uploadedPath ?? undefined,
        display_name: displayName.trim() || undefined,
      },
    })
  }

  const currentLogoSrc = logoPreview ?? (uploadedPath ? null : null)

  return (
    <div className="space-y-8 max-w-xl">

      {/* ── Logo ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Logo da Unidade</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exibida na sidebar e nos PDFs gerados. Máximo 2MB.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Preview / placeholder */}
          <div className="relative w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {currentLogoSrc ? (
              <img src={currentLogoSrc} alt="Logo da unidade" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground select-none">
                {(displayName || 'C').charAt(0).toUpperCase()}
              </span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Enviando…' : 'Selecionar logo'}
            </Button>
            {(currentLogoSrc || uploadedPath) && (
              <button
                onClick={handleRemoveLogo}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
                Remover logo
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleLogoFile(file)
            }}
          />
        </div>
      </section>

      {/* ── Nome de exibição ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Nome de Exibição</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nome curto exibido na sidebar ao lado do logo. Deixe em branco para usar o nome completo da unidade.
          </p>
        </div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Ex: Pinheiros, Unidade SP…"
          maxLength={30}
          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm
            placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
            hover:border-border-strong transition-colors"
        />
      </section>

      {/* ── Cor accent ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-muted-foreground" />
            Cor de Destaque
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplicada nos botões primários, item ativo da sidebar, badges e barras de progresso.
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              title={preset.label}
              onClick={() => { setSelectedColor(preset.value); setCustomColor(preset.value) }}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-transform active:scale-95',
                selectedColor === preset.value
                  ? 'border-foreground scale-110 shadow-md'
                  : 'border-transparent hover:scale-105',
              )}
              style={{ backgroundColor: preset.value }}
            >
              {selectedColor === preset.value && (
                <Check className="w-3.5 h-3.5 mx-auto text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>

        {/* Custom color picker */}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value)
              setSelectedColor(e.target.value)
            }}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
            title="Cor personalizada"
          />
          <div className="flex-1">
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const val = e.target.value
                setCustomColor(val)
                if (/^#[0-9a-fA-F]{6}$/.test(val)) setSelectedColor(val)
              }}
              placeholder="#7C8D78"
              maxLength={7}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm font-mono
                placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                hover:border-border-strong transition-colors"
            />
          </div>
          {/* Preview */}
          <div
            className="h-10 px-4 rounded-lg flex items-center text-xs font-semibold text-white shadow-sm shrink-0"
            style={{ backgroundColor: selectedColor }}
          >
            Preview
          </div>
        </div>
      </section>

      {/* ── Save ── */}
      <div className="pt-2 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
          className="gap-2"
        >
          {updateSettings.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : (
            'Salvar identidade visual'
          )}
        </Button>
      </div>
    </div>
  )
}
