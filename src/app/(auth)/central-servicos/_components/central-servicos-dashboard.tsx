'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Link2, Contact, Megaphone, ChevronRight, CheckCircle2, AlertCircle, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  useCentralServicosAvisos,
  useConfirmarLeitura,
} from '@/hooks/use-central-servicos-avisos'
import {
  useCentralServicosLinks,
  useCentralServicosPermissions,
} from '@/hooks/use-central-servicos-links'
import { useCentralServicosContatos } from '@/hooks/use-central-servicos-contatos'
import { avisoEstado } from '@/types/central-servicos'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const fmt = (iso: string) => dateFmt.format(new Date(iso))

// ── KPI / atalho ──────────────────────────────────────────────
function StatCard({
  href, icon: Icon, label, count, loading,
}: {
  href: string
  icon: typeof Link2
  label: string
  count: number
  loading: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col rounded-xl border border-border bg-card p-5',
        'transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {loading ? '—' : count}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Link>
  )
}

export function CentralServicosDashboard() {
  const { profile } = useAuth()
  const myId = profile?.id
  const { data: perms } = useCentralServicosPermissions()
  const canEdit = perms?.canEdit ?? false
  const confirmar = useConfirmarLeitura()

  const { data: avisos = [], isLoading: loadingAvisos, isError: avisosError, refetch: refetchAvisos } = useCentralServicosAvisos()
  const { data: links = [], isLoading: loadingLinks, isError: linksError, refetch: refetchLinks } = useCentralServicosLinks()
  const { data: contatos = [], isLoading: loadingContatos, isError: contatosError, refetch: refetchContatos } = useCentralServicosContatos()

  const anyError = avisosError || linksError || contatosError
  function retryAll() {
    if (avisosError) void refetchAvisos()
    if (linksError) void refetchLinks()
    if (contatosError) void refetchContatos()
  }

  const vigentes = useMemo(() => avisos.filter((a) => avisoEstado(a) === 'vigente'), [avisos])
  const pessoasCount = useMemo(() => contatos.filter((c) => c.tipo === 'pessoa').length, [contatos])

  // Meus avisos pendentes de confirmação (vigentes, exige ciente, eu ainda não confirmei).
  const myPending = useMemo(
    () => vigentes.filter((a) => a.exige_confirmacao && !a.leituras.some((l) => l.usuario_id === myId)),
    [vigentes, myId],
  )

  // Para gestor: avisos vigentes que exigem ciente, com a contagem de quem confirmou.
  const gestaoConfirmacoes = useMemo(
    () => (canEdit ? vigentes.filter((a) => a.exige_confirmacao) : []),
    [vigentes, canEdit],
  )

  return (
    <div className="space-y-6">
      {/* KPIs / atalhos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          href={ROUTES.centralServicosLinks}
          icon={Link2}
          label="Links úteis"
          count={links.length}
          loading={loadingLinks}
        />
        <StatCard
          href={ROUTES.centralServicosContatos}
          icon={Contact}
          label="Contatos"
          count={pessoasCount}
          loading={loadingContatos}
        />
        <StatCard
          href={ROUTES.centralServicosAvisos}
          icon={Megaphone}
          label="Avisos vigentes"
          count={vigentes.length}
          loading={loadingAvisos}
        />
      </div>

      {/* Erro ao carregar dados (não bloqueia os atalhos, que mostram '—') */}
      {anyError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-status-error-text/30 bg-status-error-bg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-status-error-text">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Não foi possível carregar alguns dados.
          </div>
          <button
            type="button"
            onClick={retryAll}
            className="shrink-0 text-sm font-medium text-status-error-text underline underline-offset-4"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Meus avisos pendentes de confirmação */}
      {myPending.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-text-link" />
            Pendentes da sua confirmação
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
              {myPending.length}
            </span>
          </h2>
          <ul className="mt-3 space-y-2">
            {myPending.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <Link
                  href={ROUTES.centralServicosAvisos}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-text-link"
                >
                  {a.titulo}
                </Link>
                <Button
                  type="button"
                  size="sm"
                  disabled={confirmar.isPending || !myId}
                  onClick={() => myId && confirmar.mutate({ avisoId: a.id, userId: myId })}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Confirmo que li
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Acompanhamento de confirmações (gestão) */}
      {gestaoConfirmacoes.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-text-link" />
            Acompanhamento de confirmações
          </h2>
          <ul className="mt-3 space-y-2">
            {gestaoConfirmacoes.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={ROUTES.centralServicosAvisos}
                    className="block truncate text-sm font-medium text-foreground hover:text-text-link"
                  >
                    {a.titulo}
                  </Link>
                  <span className="text-xs text-muted-foreground">Publicado em {fmt(a.publicado_em)}</span>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
                  {a.leituras.length} {a.leituras.length === 1 ? 'confirmou' : 'confirmaram'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
