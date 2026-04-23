import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  getDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ExportData, SanitizedEvent } from './types'

// ─────────────────────────────────────────────────────────────
// ATENÇÃO: cores DEVEM ser inline styles com hex.
// html2canvas não suporta oklch() do Tailwind v4.
// Font: Arial — métricas previsíveis no canvas.
// Sem flex+alignItems em badges (bug de baseline no html2canvas).
// height === lineHeight (px fixo) para clipping zero.
// ─────────────────────────────────────────────────────────────

const C = {
  white:   '#ffffff',
  gray50:  '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray800: '#1f2937',
  gray900: '#111827',
  red50:   '#fef2f2',
  red200:  '#fecaca',
  red500:  '#ef4444',
  amber50: '#fffbeb',
  amber200:'#fde68a',
  amber400:'#fbbf24',
} as const

const FONT = 'Arial, Helvetica, sans-serif'
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// chip colorido + texto — inline-block em vez de flex
// evita bug de baseline calculation do html2canvas
function EventBadge({ ev }: { ev: SanitizedEvent }) {
  const timeLabel =
    ev.startTime && ev.endTime
      ? `${ev.startTime}-${ev.endTime}`
      : ev.startTime || 'A confirmar'

  const isOcupado = ev.status === 'ocupado'
  return (
    <div
      style={{
        display: 'block',
        height: 22,
        lineHeight: '22px',
        fontSize: 11,
        fontFamily: FONT,
        color: C.gray900,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: isOcupado ? C.red500 : C.amber400,
          marginRight: 5,
          verticalAlign: 'middle',
          position: 'relative',
          top: 2,
        }}
      />
      {timeLabel}
    </div>
  )
}

// ─── View: MÊS ───────────────────────────────────────────────

function MonthGrid({
  period,
  eventsByDate,
}: {
  period: ExportData['period']
  eventsByDate: Record<string, SanitizedEvent[]>
}) {
  const firstDay = new Date(
    period.referenceDate.getFullYear(),
    period.referenceDate.getMonth(),
    1,
  )
  const lastDay = new Date(
    period.referenceDate.getFullYear(),
    period.referenceDate.getMonth() + 1,
    0,
  )

  const startPadding = getDay(firstDay)
  const endPadding = 6 - getDay(lastDay)

  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const cells: (Date | null)[] = [
    ...Array(startPadding).fill(null),
    ...days,
    ...Array(endPadding).fill(null),
  ]

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {WEEK_DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: C.gray500, padding: '3px 0', fontFamily: FONT }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grade */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, backgroundColor: C.gray200 }}>
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`pad-${i}`} style={{ backgroundColor: C.gray50, minHeight: 100 }} />
          }

          const key = format(day, 'yyyy-MM-dd')
          const evs = eventsByDate[key] ?? []

          return (
            <div
              key={key}
              style={{
                backgroundColor: C.white,
                minHeight: 100,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                // overflow: hidden REMOVIDO — EventBadge tem seu próprio controle horizontal
              }}
            >
              {/* Número do dia */}
              <div style={{ fontSize: 11, fontWeight: 600, color: C.gray500, lineHeight: 1.2, marginBottom: 3, flexShrink: 0, fontFamily: FONT }}>
                {day.getDate()}
              </div>

              {/* Eventos — gap 1 entre badges de 22px */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                {evs.map((ev) => (
                  <EventBadge key={ev.id} ev={ev} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── View: SEMANA ─────────────────────────────────────────────

function WeekGrid({
  period,
  eventsByDate,
}: {
  period: ExportData['period']
  eventsByDate: Record<string, SanitizedEvent[]>
}) {
  const weekStart = startOfWeek(period.referenceDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(period.referenceDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd')
        const evs = eventsByDate[key] ?? []
        return (
          <div
            key={key}
            style={{
              border: `1px solid ${C.gray200}`,
              borderRadius: 6,
              padding: 8,
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 8, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.gray500, lineHeight: 1.2, fontFamily: FONT }}>
                {format(day, 'EEE', { locale: ptBR }).toUpperCase()}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.gray800, lineHeight: 1.2, fontFamily: FONT }}>
                {day.getDate()}
              </div>
            </div>
            {evs.length === 0 ? (
              <div style={{ fontSize: 10, textAlign: 'center', color: C.gray300, fontFamily: FONT }}>Livre</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                {evs.map((ev) => {
                  const timeLabel = ev.startTime && ev.endTime
                    ? `${ev.startTime}-${ev.endTime}`
                    : ev.startTime || 'A confirmar'
                  const isOcupado = ev.status === 'ocupado'
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'block',
                        height: 22,
                        lineHeight: '22px',
                        fontSize: 12,
                        fontFamily: FONT,
                        color: C.gray900,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: isOcupado ? C.red500 : C.amber400,
                        marginRight: 6,
                        verticalAlign: 'middle',
                        position: 'relative',
                        top: 2,
                      }} />
                      {timeLabel}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── View: DIA ────────────────────────────────────────────────

function DayView({
  period,
  eventsByDate,
}: {
  period: ExportData['period']
  eventsByDate: Record<string, SanitizedEvent[]>
}) {
  const key = format(period.referenceDate, 'yyyy-MM-dd')
  const evs = eventsByDate[key] ?? []
  const dayLabel = format(period.referenceDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, padding: 24 }}>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: C.gray800, marginBottom: 16, textTransform: 'capitalize', lineHeight: 1.3, fontFamily: FONT }}>
        {dayLabel}
      </h3>
      {evs.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, color: C.gray400, fontSize: 13, fontFamily: FONT }}>
          Nenhum evento neste dia
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {evs.map((ev) => {
            const timeLabel = ev.startTime && ev.endTime
              ? `${ev.startTime}-${ev.endTime}`
              : ev.startTime || 'A confirmar'
            const isOcupado = ev.status === 'ocupado'
            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 8,
                  padding: '12px 16px',
                  backgroundColor: isOcupado ? C.red50 : C.amber50,
                  border: `1px solid ${isOcupado ? C.red200 : C.amber200}`,
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, backgroundColor: isOcupado ? C.red500 : C.amber400 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: C.gray800, lineHeight: 1.45, fontFamily: FONT }}>{timeLabel}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: isOcupado ? C.red500 : C.amber400,
                    color: isOcupado ? C.white : C.gray900,
                    lineHeight: 1.45,
                    fontFamily: FONT,
                  }}
                >
                  {isOcupado ? 'Ocupado' : 'Reservado'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Legenda ─────────────────────────────────────────────────

function Legend() {
  const items = [
    { bg: C.red500, label: 'Ocupado' },
    { bg: C.amber400, label: 'Reservado' },
    { bg: C.white, border: C.gray300, label: 'Disponivel' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, fontSize: 11, lineHeight: 1.45, color: C.gray800, fontFamily: FONT }}>
      {items.map(({ bg, border, label }) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: bg, border: border ? `1px solid ${border}` : undefined, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────

export function CalendarExportView({ sanitizedEvents, unitName, period }: ExportData) {
  const eventsByDate: Record<string, SanitizedEvent[]> = {}
  for (const ev of sanitizedEvents) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []
    eventsByDate[ev.date].push(ev)
  }

  const periodLabel = (() => {
    if (period.viewType === 'month') {
      return format(period.referenceDate, "MMMM 'de' yyyy", { locale: ptBR })
    }
    if (period.viewType === 'week') {
      const ws = startOfWeek(period.referenceDate, { weekStartsOn: 0 })
      const we = endOfWeek(period.referenceDate, { weekStartsOn: 0 })
      return `${format(ws, 'dd/MM')} - ${format(we, 'dd/MM/yyyy')}`
    }
    return format(period.referenceDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  })()

  const periodLabelCap = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)

  return (
    <div
      style={{
        backgroundColor: C.white,
        padding: 32,
        fontFamily: FONT,
        color: C.gray900,
        width: 900,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ borderBottom: `1px solid ${C.gray200}`, paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.gray900, margin: 0, lineHeight: 1.2, fontFamily: FONT }}>Buffet Cachola</h1>
        <p style={{ fontSize: 15, color: C.gray500, marginTop: 4, marginBottom: 0, lineHeight: 1.45, fontFamily: FONT }}>
          Unidade {unitName} · {periodLabelCap}
        </p>
      </div>

      {period.viewType === 'month' && <MonthGrid period={period} eventsByDate={eventsByDate} />}
      {period.viewType === 'week'  && <WeekGrid  period={period} eventsByDate={eventsByDate} />}
      {period.viewType === 'day'   && <DayView   period={period} eventsByDate={eventsByDate} />}

      <Legend />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${C.gray100}`,
          fontSize: 11,
          lineHeight: 1.45,
          color: C.gray400,
          fontFamily: FONT,
        }}
      >
        <span>cachola.cloud</span>
        <span>Gerado em {format(new Date(), 'dd/MM/yyyy')}</span>
      </div>
    </div>
  )
}
