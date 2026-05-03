'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CalendarExportView } from './calendar-export-view'
import { sanitizeEventsForExport } from './sanitize-events'
import { buildExportFileName } from './build-file-name'
import type { CalendarEvent } from '@/hooks/use-dashboard'
import type { CalendarPreReserva } from '@/types/pre-reservas'
import type { ExportPeriod } from './types'

function formatGeneratedAt(date: Date): string {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}h${get('minute')} (Horário de Brasília)`
}

type Props = {
  events: CalendarEvent[]
  preReservas: CalendarPreReserva[]
  unitName: string
  period: ExportPeriod
  disabled?: boolean
}

export function CalendarExportButton({
  events,
  preReservas,
  unitName,
  period,
  disabled,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const generatedAtRef = useRef<string>('')

  const handleExport = async () => {
    try {
      generatedAtRef.current = formatGeneratedAt(new Date())
      setGenerating(true)
      setMounted(true)

      // Aguarda 3 frames + 200ms para garantir que o portal pintou e Tailwind aplicou os estilos
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 200))

      if (!exportRef.current) throw new Error('Export ref not ready')

      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: false,
        allowTaint: false,
        onclone: (clonedDoc) => {
          // Remove todos os stylesheets do clone para evitar que o html2canvas
          // tente parsear oklch() do Tailwind v4 (não suportado pelo html2canvas).
          // O CalendarExportView usa 100% inline styles — remoção é segura.
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove())
          clonedDoc.documentElement.style.backgroundColor = '#ffffff'
          clonedDoc.body.style.backgroundColor = '#ffffff'
        },
      })

      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = buildExportFileName(unitName, period)
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('[CalendarExport] falha ao gerar PNG', err)
      toast.error('Não foi possível gerar o calendário. Tente novamente.')
    } finally {
      setGenerating(false)
      setMounted(false)
    }
  }

  const sanitizedEvents = sanitizeEventsForExport(events, preReservas)

  return (
    <>
      <button
        onClick={handleExport}
        disabled={disabled || generating}
        title="Exportar calendário como imagem para enviar ao cliente"
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all bg-white border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="hidden sm:inline">Gerando...</span>
          </>
        ) : (
          <>
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Enviar ao cliente</span>
          </>
        )}
      </button>

      {mounted && typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              opacity: 0,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            <div ref={exportRef}>
              <CalendarExportView
                sanitizedEvents={sanitizedEvents}
                unitName={unitName}
                period={period}
                generatedAtFormatted={generatedAtRef.current}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
