'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Search, X, Calendar, CheckSquare, Wrench, Package,
  Zap, Clock, LayoutDashboard, Settings, BarChart2,
  ClipboardList, Building2, Users, Handshake,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useCommandPaletteIndex } from '@/hooks/use-command-palette-search'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

type ResultGroup = 'recent' | 'page' | 'action' | 'event' | 'checklist' | 'maintenance' | 'equipment' | 'provider'

interface FlatResult {
  id: string
  label: string
  sublabel?: string
  href: string
  group: ResultGroup
  iconEl: React.ReactNode
}

// ── Static data ───────────────────────────────────────────────

const PAGES: FlatResult[] = [
  { id: 'p-dashboard',    label: 'Dashboard',     sublabel: 'Visão geral das operações',     href: '/dashboard',       group: 'page', iconEl: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'p-eventos',      label: 'Eventos',        sublabel: 'Lista e calendário de eventos', href: '/eventos',          group: 'page', iconEl: <Calendar        className="w-4 h-4" /> },
  { id: 'p-checklists',   label: 'Checklists',     sublabel: 'Checklists e templates',        href: '/checklists',       group: 'page', iconEl: <ClipboardList   className="w-4 h-4" /> },
  { id: 'p-manutencao',   label: 'Manutenção',     sublabel: 'Ordens de serviço',             href: '/manutencao',       group: 'page', iconEl: <Wrench          className="w-4 h-4" /> },
  { id: 'p-relatorios',   label: 'Relatórios',     sublabel: 'Dashboards analíticos',         href: '/relatorios',       group: 'page', iconEl: <BarChart2       className="w-4 h-4" /> },
  { id: 'p-equipamentos', label: 'Equipamentos',   sublabel: 'Cadastro de ativos',            href: '/equipamentos',     group: 'page', iconEl: <Package         className="w-4 h-4" /> },
  { id: 'p-prestadores',  label: 'Prestadores',    sublabel: 'DJs, fotógrafos, decoradores',  href: '/prestadores',      group: 'page', iconEl: <Handshake       className="w-4 h-4" /> },
  { id: 'p-config',       label: 'Configurações',  sublabel: 'Tipos, pacotes e horários',     href: '/configuracoes',    group: 'page', iconEl: <Settings        className="w-4 h-4" /> },
  { id: 'p-usuarios',     label: 'Usuários',       sublabel: 'Gestão de equipe',              href: '/admin/usuarios',   group: 'page', iconEl: <Users           className="w-4 h-4" /> },
  { id: 'p-unidades',     label: 'Unidades',       sublabel: 'Gerenciar unidades',            href: '/admin/unidades',   group: 'page', iconEl: <Building2       className="w-4 h-4" /> },
]

const ACTIONS: FlatResult[] = [
  { id: 'a-new-evento',   label: 'Novo Evento',                sublabel: 'Criar um novo evento',        href: '/eventos/novo',              group: 'action', iconEl: <Zap className="w-4 h-4" /> },
  { id: 'a-new-manut',    label: 'Novo Chamado de Manutenção',  sublabel: 'Abrir chamado de manutenção', href: '/manutencao/chamados',        group: 'action', iconEl: <Zap className="w-4 h-4" /> },
  { id: 'a-new-template', label: 'Novo Template de Checklist', sublabel: 'Criar modelo de checklist',   href: '/checklists/templates/novo',  group: 'action', iconEl: <Zap className="w-4 h-4" /> },
  { id: 'a-new-equip',       label: 'Novo Equipamento',           sublabel: 'Cadastrar ativo',             href: '/equipamentos/novo',     group: 'action', iconEl: <Zap className="w-4 h-4" /> },
  { id: 'a-new-prestador',   label: 'Novo Prestador',             sublabel: 'Cadastrar prestador',         href: '/prestadores/novo',      group: 'action', iconEl: <Zap className="w-4 h-4" /> },
  { id: 'a-new-usuario',     label: 'Convidar Usuário',           sublabel: 'Adicionar membro da equipe',  href: '/admin/usuarios/novo',   group: 'action', iconEl: <Zap className="w-4 h-4" /> },
]

// ── Helpers ───────────────────────────────────────────────────

const CL_STATUS: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em Andamento', completed: 'Concluído', cancelled: 'Cancelado',
}
const MN_TYPE: Record<string, string> = {
  emergency: 'Emergencial', punctual: 'Pontual', recurring: 'Recorrente',
}
const MN_STATUS: Record<string, string> = {
  open: 'Aberta', in_progress: 'Em Andamento', waiting_parts: 'Aguardando Peças', completed: 'Concluída',
}

function fmtDate(d: string): string {
  try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) }
  catch { return d }
}

function fuzzy(text: string, q: string): boolean {
  if (!q) return true
  const t = text.toLowerCase()
  return q.toLowerCase().trim().split(/\s+/).every((w) => t.includes(w))
}

const GROUP_META: Record<ResultGroup, { label: string; iconClass: string }> = {
  recent:      { label: 'Recentes',     iconClass: 'icon-gray'   },
  page:        { label: 'Páginas',      iconClass: 'icon-gray'   },
  action:      { label: 'Ações rápidas',iconClass: 'icon-purple' },
  event:       { label: 'Eventos',      iconClass: 'icon-brand'  },
  checklist:   { label: 'Checklists',   iconClass: 'icon-green'  },
  maintenance: { label: 'Manutenções',  iconClass: 'icon-amber'  },
  equipment:   { label: 'Equipamentos', iconClass: 'icon-gray'   },
  provider:    { label: 'Prestadores',  iconClass: 'icon-brand'  },
}

// ── ResultItem ────────────────────────────────────────────────

function ResultItem({
  item,
  sectionGroup,
  isSelected,
  onSelect,
}: {
  item: FlatResult
  sectionGroup: ResultGroup
  isSelected: boolean
  onSelect: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isSelected])

  const iconClass = GROUP_META[sectionGroup].iconClass

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 rounded-xl transition-colors text-left',
        'min-h-[44px] py-2',
        isSelected ? 'bg-accent' : 'hover:bg-accent/60',
      )}
    >
      {/* Icon */}
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
        iconClass,
      )}>
        {item.iconEl}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
        {item.sublabel && (
          <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
        )}
      </div>

      {/* Enter hint when selected */}
      {isSelected && (
        <kbd className="shrink-0 hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ↵
        </kbd>
      )}
    </button>
  )
}

// ── CommandPalette ────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter()
  const { isOpen, open, close, recentItems, addRecent } = useCommandPaletteStore()
  const { data: index, isLoading: indexLoading } = useCommandPaletteIndex(isOpen)

  const [query,         setQuery]         = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mounted,       setMounted]       = useState(false)

  const debouncedQuery = useDebounce(query, 200)
  const inputRef       = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // ── Global Ctrl+K / ⌘K ───────────────────────────────────
  useEffect(() => {
    function onGlobal(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        isOpen ? close() : open()
      }
    }
    window.addEventListener('keydown', onGlobal)
    return () => window.removeEventListener('keydown', onGlobal)
  }, [isOpen, open, close])

  // ── Auto-focus & reset on open ───────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // ── Build result groups ───────────────────────────────────
  const groups = useMemo((): { group: ResultGroup; items: FlatResult[] }[] => {
    const q = debouncedQuery.trim()

    if (!q) {
      const res: { group: ResultGroup; items: FlatResult[] }[] = []

      if (recentItems.length > 0) {
        res.push({
          group: 'recent',
          items: recentItems.map((r): FlatResult => ({
            id:       r.id,
            label:    r.label,
            sublabel: r.sublabel,
            href:     r.href,
            group:    'recent',
            iconEl:   <Clock className="w-4 h-4" />,
          })),
        })
      }

      res.push({ group: 'page',   items: PAGES.slice(0, 6)   })
      res.push({ group: 'action', items: ACTIONS.slice(0, 4) })
      return res
    }

    const res: { group: ResultGroup; items: FlatResult[] }[] = []

    // Events
    if (index?.events) {
      const items = index.events
        .filter((e) => fuzzy(e.client_name, q))
        .slice(0, 5)
        .map((e): FlatResult => ({
          id:       `event-${e.id}`,
          label:    e.client_name,
          sublabel: fmtDate(e.date),
          href:     `/eventos/${e.id}`,
          group:    'event',
          iconEl:   <Calendar className="w-4 h-4" />,
        }))
      if (items.length) res.push({ group: 'event', items })
    }

    // Checklists
    if (index?.checklists) {
      const items = index.checklists
        .filter((c) => fuzzy(c.title, q))
        .slice(0, 5)
        .map((c): FlatResult => ({
          id:       `cl-${c.id}`,
          label:    c.title,
          sublabel: CL_STATUS[c.status] ?? c.status,
          href:     `/checklists/${c.id}`,
          group:    'checklist',
          iconEl:   <CheckSquare className="w-4 h-4" />,
        }))
      if (items.length) res.push({ group: 'checklist', items })
    }

    // Maintenance
    if (index?.maintenance) {
      const items = index.maintenance
        .filter((m) => fuzzy(m.title, q))
        .slice(0, 5)
        .map((m): FlatResult => ({
          id:       `mn-${m.id}`,
          label:    m.title,
          sublabel: `${MN_TYPE[m.type] ?? m.type} — ${MN_STATUS[m.status] ?? m.status}`,
          href:     `/manutencao/${m.id}`,
          group:    'maintenance',
          iconEl:   <Wrench className="w-4 h-4" />,
        }))
      if (items.length) res.push({ group: 'maintenance', items })
    }

    // Equipment
    if (index?.equipment) {
      const items = index.equipment
        .filter((e) => fuzzy(`${e.name} ${e.category ?? ''}`, q))
        .slice(0, 5)
        .map((e): FlatResult => ({
          id:       `eq-${e.id}`,
          label:    e.name,
          sublabel: e.category ?? undefined,
          href:     `/equipamentos/${e.id}`,
          group:    'equipment',
          iconEl:   <Package className="w-4 h-4" />,
        }))
      if (items.length) res.push({ group: 'equipment', items })
    }

    // Providers
    if (index?.providers) {
      const items = index.providers
        .filter((p) => fuzzy(p.name, q))
        .slice(0, 5)
        .map((p): FlatResult => ({
          id:       `pr-${p.id}`,
          label:    p.name,
          sublabel: p.avg_rating ? `★ ${p.avg_rating.toFixed(1)}` : 'Prestador ativo',
          href:     `/prestadores/${p.id}`,
          group:    'provider',
          iconEl:   <Handshake className="w-4 h-4" />,
        }))
      if (items.length) res.push({ group: 'provider', items })
    }

    // Pages
    const pageMatches = PAGES
      .filter((p) => fuzzy(`${p.label} ${p.sublabel ?? ''}`, q))
      .slice(0, 4)
    if (pageMatches.length) res.push({ group: 'page', items: pageMatches })

    // Actions
    const actionMatches = ACTIONS
      .filter((a) => fuzzy(`${a.label} ${a.sublabel ?? ''}`, q))
      .slice(0, 3)
    if (actionMatches.length) res.push({ group: 'action', items: actionMatches })

    return res
  }, [debouncedQuery, index, recentItems])

  const flatResults = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // ── Keyboard navigation ───────────────────────────────────
  useEffect(() => { setSelectedIndex(0) }, [debouncedQuery])

  const handleSelect = useCallback((item: FlatResult) => {
    addRecent({
      id:       item.id,
      label:    item.label,
      sublabel: item.sublabel,
      href:     item.href,
      group:    item.group,
    })
    router.push(item.href)
    close()
  }, [addRecent, router, close])

  useEffect(() => {
    function onNav(e: KeyboardEvent) {
      if (!isOpen) return
      switch (e.key) {
        case 'Escape':
          close()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter': {
          e.preventDefault()
          const item = flatResults[selectedIndex]
          if (item) handleSelect(item)
          break
        }
      }
    }
    window.addEventListener('keydown', onNav)
    return () => window.removeEventListener('keydown', onNav)
  }, [isOpen, flatResults, selectedIndex, close, handleSelect])

  if (!mounted || !isOpen) return null

  // Flat index counter for matching selectedIndex in JSX
  let flatIdx = 0

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9980] flex justify-center',
        'items-end sm:items-start sm:pt-[12vh]',
        'bg-black/60 backdrop-blur-[6px]',
      )}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className={cn(
          'relative flex flex-col bg-card border border-border shadow-2xl overflow-hidden',
          // Mobile: full-width bottom sheet
          'w-full rounded-t-2xl max-h-[85svh]',
          // Desktop: centered modal
          'sm:rounded-2xl sm:max-w-[560px] sm:max-h-[68vh]',
          'animate-scale-in',
        )}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar eventos, checklists, manutenções..."
            className={cn(
              'flex-1 bg-transparent text-base text-foreground',
              'placeholder:text-muted-foreground/55 outline-none',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              Esc
            </kbd>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">

          {/* Loading skeleton — only on first load with a query */}
          {indexLoading && !index && debouncedQuery && (
            <div className="space-y-1 px-1 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-7 h-7 rounded-lg skeleton-shimmer shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                    <div className="h-2.5 w-1/3 rounded skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {debouncedQuery && flatResults.length === 0 && !indexLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="w-8 h-8 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tente buscar por outro termo
              </p>
            </div>
          )}

          {/* Result groups */}
          {groups.map(({ group, items }) => (
            <div key={group}>
              {/* Section header */}
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {GROUP_META[group].label}
              </p>

              {/* Items */}
              {items.map((item) => {
                const idx = flatIdx++
                return (
                  <ResultItem
                    key={item.id}
                    item={item}
                    sectionGroup={group}
                    isSelected={idx === selectedIndex}
                    onSelect={() => handleSelect(item)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-border bg-muted rounded px-1 text-[10px]">↑↓</kbd>
            <span>navegar</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-border bg-muted rounded px-1 text-[10px]">↵</kbd>
            <span>abrir</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-border bg-muted rounded px-1 text-[10px]">Esc</kbd>
            <span>fechar</span>
          </span>
          <span className="ml-auto hidden sm:block opacity-60">
            Ctrl+K para abrir
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
