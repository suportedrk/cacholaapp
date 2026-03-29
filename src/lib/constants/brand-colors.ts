/**
 * Brand colors para uso em contextos onde CSS vars não funcionam:
 * - Recharts (propriedades `color` em JS)
 * - Exports PDF/Excel (html2canvas, jsPDF)
 * - HTML de e-mails (inline styles)
 *
 * REGRA: Nunca importar esses valores direto na UI — usar tokens CSS via Tailwind.
 * Use apenas em: recharts, exports, email templates.
 */

// Verde sálvia (primário) — rampa 50–900
export const BRAND_GREEN = {
  50:  '#f0f5ef',
  100: '#dceada',
  200: '#bcd5b8',
  300: '#93b88d',
  400: '#7da078',   // brand-primary-light
  500: '#7C8D78',   // brand-primary (base)
  600: '#697a65',   // brand-primary-dark
  700: '#566353',
  800: '#424d40',
  900: '#2e362c',
} as const

// Bege quente (secundário) — rampa 50–900
export const BRAND_BEIGE = {
  50:  '#faf9f7',
  100: '#f5f2ee',
  200: '#ede8e2',
  300: '#e8e1d9',
  400: '#e5ddd5',
  500: '#E3DAD1',   // brand-secondary (base)
  600: '#cdc2b6',
  700: '#b3a394',
  800: '#8e7f71',
  900: '#665c51',
} as const

// Cores semânticas para gráficos (Recharts)
export const CHART_COLORS = {
  // Eventos por status
  eventPending:    BRAND_BEIGE[500],
  eventConfirmed:  BRAND_GREEN[500],
  eventPreparing:  '#6B9E8B',
  eventInProgress: '#4A5E46',
  eventFinished:   BRAND_GREEN[200],
  eventLost:       '#9CA3AF',

  // Manutenção
  maintenanceOpen:     '#E07070',
  maintenanceClosed:   BRAND_GREEN[500],
  maintenancePending:  BRAND_BEIGE[600],

  // Checklists
  checklistDone:  BRAND_GREEN[500],
  checklistLate:  '#E07070',

  // Staff
  staffEvents:     BRAND_GREEN[500],
  staffChecklists: '#6B9E8B',

  // Genérico
  primary:   BRAND_GREEN[500],
  secondary: BRAND_BEIGE[500],
  danger:    '#E07070',
  neutral:   BRAND_GREEN[200],

  // Verde-água (complementar)
  tealMid:   '#6B9E8B',
  tealLight: '#A8C5BD',
} as const
