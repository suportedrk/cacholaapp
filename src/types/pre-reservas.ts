// ============================================================
// TYPES — Pré-reservas Diretoria (Migration 045)
// ============================================================

export interface PreReservaDiretoria {
  id:             string
  unit_id:        string
  date:           string        // 'YYYY-MM-DD'
  time:           string | null // 'HH:mm:ss' ou null
  client_name:    string
  client_contact: string | null
  description:    string | null
  created_by:     string
  created_at:     string
  updated_at:     string
}

export interface PreReservaDiretoriaInsert {
  unit_id:         string
  date:            string
  time?:           string | null
  client_name:     string
  client_contact?: string | null
  description?:    string | null
}

export interface PreReservaDiretoriaUpdate {
  date?:           string
  time?:           string | null
  client_name?:    string
  client_contact?: string | null
  description?:    string | null
}

/** Forma normalizada para o CalendarView */
export interface CalendarPreReserva {
  id:              string
  title:           string   // = client_name
  date:            string   // 'YYYY-MM-DD'
  time?:           string   // 'HH:mm' se existir
  type:            'pre-reserva'
  description?:    string | null
  client_contact?: string | null
  unit_id:         string
  created_by:      string
}
