export type SanitizedEvent = {
  id: string
  date: string       // 'YYYY-MM-DD'
  startTime: string  // '14h00' ou ''
  endTime: string    // '18h00' ou ''
  status: 'ocupado' | 'reservado'
}

export type ExportPeriod = {
  viewType: 'month' | 'week' | 'day'
  startDate: Date
  endDate: Date
  referenceDate: Date
}

export type ExportData = {
  sanitizedEvents: SanitizedEvent[]
  unitName: string
  period: ExportPeriod
}
