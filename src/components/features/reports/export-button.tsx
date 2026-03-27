'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportToExcel, exportToPDF } from '@/lib/utils/export'
import type { ReportFilters } from '@/types/database.types'

type ExportButtonProps = {
  // Excel
  rows:       Record<string, string | number | null | undefined>[]
  columns:    { key: string; header: string }[]
  // PDF
  elementId:  string
  tabName:    string
  filters:    ReportFilters
  unitName?:  string
  disabled?:  boolean
}

function periodLabel(filters: ReportFilters) {
  return `${filters.from} a ${filters.to}`
}

function filename(tab: string, filters: ReportFilters) {
  return `relatorio_${tab}_${filters.from}_${filters.to}`
}

export function ExportButton({
  rows, columns, elementId, tabName,
  filters, unitName = 'Todas as unidades', disabled,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExcel() {
    try {
      setLoading(true)
      await exportToExcel(rows, columns, filename(tabName, filters))
      toast.success('Excel exportado com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao exportar Excel')
    } finally {
      setLoading(false)
    }
  }

  async function handlePDF() {
    try {
      setLoading(true)
      await exportToPDF(
        elementId,
        `Relatório — ${tabName}`,
        unitName,
        periodLabel(filters),
        filename(tabName, filters)
      )
      toast.success('PDF exportado com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao exportar PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      {/* @ts-expect-error asChild handled by Radix at runtime */}
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || loading} className="h-9 gap-1.5">
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />
          }
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={handleExcel}>
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          Exportar Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={handlePDF}>
          <FileText className="w-4 h-4 text-red-600" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
