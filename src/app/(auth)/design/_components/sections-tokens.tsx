import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BRAND_GREEN,
  BRAND_BEIGE,
  BRAND_TERRACOTA,
  CHART_COLORS,
} from '@/lib/constants/brand-colors'
import { ShowcaseSection, ShowcaseCard, Swatch } from './primitives'

type HexMap = Record<number, string>

// Rampas — a classe `bg-*` precisa ser literal (Tailwind v4 não gera de template).
// O hex ao lado vem de brand-colors.ts (referência p/ Recharts/jsPDF/e-mail).
const BRAND_RAMP = [
  'bg-brand-50', 'bg-brand-100', 'bg-brand-200', 'bg-brand-300', 'bg-brand-400',
  'bg-brand-500', 'bg-brand-600', 'bg-brand-700', 'bg-brand-800', 'bg-brand-900',
]
const BEIGE_RAMP = [
  'bg-beige-50', 'bg-beige-100', 'bg-beige-200', 'bg-beige-300', 'bg-beige-400',
  'bg-beige-500', 'bg-beige-600', 'bg-beige-700', 'bg-beige-800', 'bg-beige-900',
]
const TERRACOTA_RAMP = [
  'bg-terracota-50', 'bg-terracota-100', 'bg-terracota-200', 'bg-terracota-300', 'bg-terracota-400',
  'bg-terracota-500', 'bg-terracota-600', 'bg-terracota-700', 'bg-terracota-800', 'bg-terracota-900',
]
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

function Ramp({ classes, hex }: { classes: string[]; hex: HexMap }) {
  return (
    <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
      {classes.map((cls, i) => (
        <Swatch key={cls} swatchClassName={cls} name={String(STEPS[i])} value={hex[STEPS[i]]} />
      ))}
    </div>
  )
}

export function TokensCores() {
  return (
    <ShowcaseSection
      id="cores"
      title="Cores — Rampas"
      description="Verde sálvia (brand), bege quente (beige) e terracota (identidade Moema). A amostra usa o token real (oklch); o hex é a referência de brand-colors.ts."
    >
      <ShowcaseCard title="Brand — verde sálvia">
        <Ramp classes={BRAND_RAMP} hex={BRAND_GREEN as HexMap} />
      </ShowcaseCard>
      <ShowcaseCard title="Beige — bege quente">
        <Ramp classes={BEIGE_RAMP} hex={BRAND_BEIGE as HexMap} />
      </ShowcaseCard>
      <ShowcaseCard title="Terracota — identidade Moema">
        <Ramp classes={TERRACOTA_RAMP} hex={BRAND_TERRACOTA as HexMap} />
      </ShowcaseCard>
      <ShowcaseCard
        title="CHART_COLORS — exceções legítimas de hex"
        hint="Recharts / jsPDF / e-mail — NÃO usar na UI"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Object.entries(CHART_COLORS).map(([name, hex]) => (
            <div key={name} className="flex flex-col gap-1">
              <div
                className="h-12 w-full rounded-md border border-border-default"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-[11px] text-foreground">{name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{hex}</span>
            </div>
          ))}
        </div>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}

export function TokensSemanticos() {
  return (
    <ShowcaseSection
      id="semanticos"
      title="Tokens semânticos"
      description="Superfícies, texto, bordas e status. Dark-mode-safe — preferir estes às rampas cruas na UI."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Superfícies">
          <div className="grid grid-cols-2 gap-3">
            <Swatch swatchClassName="bg-surface-primary" name="bg-surface-primary" />
            <Swatch swatchClassName="bg-surface-secondary" name="bg-surface-secondary" />
            <Swatch swatchClassName="bg-surface-tertiary" name="bg-surface-tertiary" />
            <Swatch swatchClassName="bg-surface-inverse" name="bg-surface-inverse" />
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Texto">
          <div className="space-y-1.5">
            <p className="text-text-primary">text-text-primary</p>
            <p className="text-text-secondary">text-text-secondary</p>
            <p className="text-text-tertiary">text-text-tertiary</p>
            <p className="text-text-link">text-text-link</p>
            <div className="rounded-md bg-surface-inverse p-2">
              <p className="text-text-inverse">text-text-inverse</p>
            </div>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Bordas">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <div className="h-12 rounded-md border-2 border-border-default" />
              <span className="font-mono text-[11px]">border-default</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-12 rounded-md border-2 border-border-strong" />
              <span className="font-mono text-[11px]">border-strong</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-12 rounded-md border-2 border-border-focus" />
              <span className="font-mono text-[11px]">border-focus</span>
            </div>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Status (bg / text / border)">
          <div className="grid grid-cols-2 gap-3">
            {(['error', 'success', 'warning', 'info'] as const).map((s) => (
              <div
                key={s}
                className={cn(
                  'rounded-md border p-2 text-xs font-medium',
                  s === 'error' && 'border-status-error-border bg-status-error-bg text-status-error-text',
                  s === 'success' && 'border-status-success-border bg-status-success-bg text-status-success-text',
                  s === 'warning' && 'border-status-warning-border bg-status-warning-bg text-status-warning-text',
                  s === 'info' && 'border-status-info-border bg-status-info-bg text-status-info-text'
                )}
              >
                status-{s}
              </div>
            ))}
          </div>
        </ShowcaseCard>
      </div>
    </ShowcaseSection>
  )
}

export function TokensTipografia() {
  return (
    <ShowcaseSection
      id="tipografia"
      title="Tipografia"
      description="Classes compostas de texto e pesos de fonte."
    >
      <ShowcaseCard>
        <div className="space-y-3">
          <p className="text-heading-1 text-foreground">text-heading-1 — Aa</p>
          <p className="text-heading-2 text-foreground">text-heading-2 — Aa</p>
          <p className="text-heading-3 text-foreground">text-heading-3 — Aa</p>
          <p className="text-heading-4 text-foreground">text-heading-4 — Aa</p>
          <p className="text-body-lg text-foreground">text-body-lg — O rato roeu a roupa do rei de Roma.</p>
          <p className="text-body text-foreground">text-body — O rato roeu a roupa do rei de Roma.</p>
          <p className="text-body-sm text-muted-foreground">text-body-sm — O rato roeu a roupa do rei de Roma.</p>
          <p className="text-caption text-muted-foreground">TEXT-CAPTION — RÓTULO</p>
          <p className="text-code text-foreground">text-code — const cachola = true</p>
        </div>
      </ShowcaseCard>
      <ShowcaseCard title="Pesos">
        <div className="flex flex-wrap gap-6">
          <span className="font-normal">font-normal 400</span>
          <span className="font-medium">font-medium 500</span>
          <span className="font-semibold">font-semibold 600</span>
          <span className="font-bold">font-bold 700</span>
        </div>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}

const SPACES = [
  ['w-1', '4px'], ['w-2', '8px'], ['w-3', '12px'], ['w-4', '16px'],
  ['w-6', '24px'], ['w-8', '32px'], ['w-12', '48px'], ['w-16', '64px'], ['w-24', '96px'],
]
const RADII = ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full']
const SHADOWS = ['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl']
const ZINDEX = [
  ['z-dropdown', 10], ['z-sticky', 20], ['z-overlay', 30],
  ['z-modal', 40], ['z-toast', 50], ['z-tooltip', 60],
]

export function TokensEspacoSombra() {
  return (
    <ShowcaseSection
      id="espaco"
      title="Espaçamento, raio, sombra e z-index"
      description="Escala de spacing, border-radius, elevação e camadas."
    >
      <ShowcaseCard title="Espaçamento">
        <div className="space-y-2">
          {SPACES.map(([cls, px]) => (
            <div key={cls} className="flex items-center gap-3">
              <div className={cn('h-4 rounded-sm bg-primary', cls)} />
              <span className="font-mono text-[11px] text-muted-foreground">{cls} · {px}</span>
            </div>
          ))}
        </div>
      </ShowcaseCard>

      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Raio (border-radius)">
          <div className="flex flex-wrap gap-4">
            {RADII.map((cls) => (
              <div key={cls} className="flex flex-col items-center gap-1">
                <div className={cn('size-12 border border-border-strong bg-secondary', cls)} />
                <span className="font-mono text-[10px] text-muted-foreground">{cls}</span>
              </div>
            ))}
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Sombra (elevação)">
          <div className="flex flex-wrap gap-6 p-2">
            {SHADOWS.map((cls) => (
              <div key={cls} className="flex flex-col items-center gap-2">
                <div className={cn('size-12 rounded-lg bg-card', cls)} />
                <span className="font-mono text-[10px] text-muted-foreground">{cls}</span>
              </div>
            ))}
          </div>
        </ShowcaseCard>
      </div>

      <ShowcaseCard title="Z-index (camadas)">
        <div className="flex flex-wrap gap-2">
          {ZINDEX.map(([name, val]) => (
            <span
              key={name}
              className="rounded-md border border-border-default bg-surface-tertiary px-2 py-1 font-mono text-[11px] text-foreground"
            >
              {name} · {val}
            </span>
          ))}
        </div>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}

const ICON_COLORS = ['icon-brand', 'icon-blue', 'icon-green', 'icon-amber', 'icon-orange', 'icon-red', 'icon-purple', 'icon-gray']
const BADGE_COLORS = ['badge-brand', 'badge-blue', 'badge-green', 'badge-amber', 'badge-orange', 'badge-red', 'badge-purple', 'badge-gray']

export function TokensUtilitarias() {
  return (
    <ShowcaseSection
      id="utilitarias"
      title="Classes utilitárias"
      description="Atalhos dark-mode-safe do design system — preferir a estes em vez de tints crus."
    >
      <ShowcaseCard title=".icon-{cor} — fundo + ícone para cards">
        <div className="flex flex-wrap gap-3">
          {ICON_COLORS.map((cls) => (
            <div key={cls} className="flex flex-col items-center gap-1">
              <span className={cn('inline-flex size-9 items-center justify-center rounded-lg', cls)}>
                <Star className="size-4" />
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{cls}</span>
            </div>
          ))}
        </div>
      </ShowcaseCard>

      <ShowcaseCard title=".badge-{cor} — pills de status">
        <div className="flex flex-wrap gap-2">
          {BADGE_COLORS.map((cls) => (
            <span
              key={cls}
              className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', cls)}
            >
              {cls}
            </span>
          ))}
        </div>
      </ShowcaseCard>

      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title=".card-interactive — hover lift">
          <div className="card-interactive cursor-pointer rounded-lg border border-border-default bg-card p-4">
            <p className="text-sm font-medium text-foreground">Passe o mouse</p>
            <p className="text-xs text-muted-foreground">translateY(-2px) + shadow + borda forte</p>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title=".skeleton-shimmer — loading (dark-safe)">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-4 w-3/4 rounded-md" />
            <div className="skeleton-shimmer h-4 w-1/2 rounded-md" />
            <div className="skeleton-shimmer h-20 w-full rounded-md" />
          </div>
        </ShowcaseCard>

        <ShowcaseCard title=".focus-ring — anel de foco acessível">
          <button className="focus-ring rounded-md border border-border-default bg-card px-3 py-1.5 text-sm text-foreground">
            Dê Tab até aqui
          </button>
        </ShowcaseCard>

        <ShowcaseCard title=".animate-badge-pulse — ênfase (respeita reduced-motion)">
          <span className="animate-badge-pulse inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium badge-red">
            Atenção
          </span>
        </ShowcaseCard>
      </div>
    </ShowcaseSection>
  )
}
