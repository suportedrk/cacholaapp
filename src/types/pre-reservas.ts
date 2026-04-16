// ============================================================
// TYPES — Pré-reservas Diretoria (Migrations 045 + 046)
// ============================================================

export interface PreReservaDiretoria {
  id:             string
  unit_id:        string
  date:           string        // 'YYYY-MM-DD'
  start_time:     string | null // 'HH:mm:ss' ou null
  end_time:       string | null // 'HH:mm:ss' ou null
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
  start_time?:     string | null
  end_time?:       string | null
  client_name:     string
  client_contact?: string | null
  description?:    string | null
}

export interface PreReservaDiretoriaUpdate {
  date?:           string
  start_time?:     string | null
  end_time?:       string | null
  client_name?:    string
  client_contact?: string | null
  description?:    string | null
}

/** Forma normalizada para o CalendarView */
export interface CalendarPreReserva {
  id:              string
  title:           string        // = client_name
  date:            string        // 'YYYY-MM-DD'
  start_time?:     string        // 'HH:mm' se existir
  end_time?:       string        // 'HH:mm' se existir
  type:            'pre-reserva'
  description?:    string | null
  client_contact?: string | null
  unit_id:         string
  created_by?:     string        // undefined para source='ploomes'
  /** Discriminador: 'diretoria' (manual) ou 'ploomes' (derivado de deal) */
  source:          'diretoria' | 'ploomes'
  /** URL do deal no Ploomes — preenchido quando source === 'ploomes' */
  ploomes_url?:    string
  /** Valor do deal em reais — preenchido quando source === 'ploomes' */
  deal_amount?:    number | null
  /** Nome do estágio Ploomes — preenchido quando source === 'ploomes' */
  stage_name?:     string | null
  /** Nome da vendedora responsável — preenchido quando source === 'ploomes' */
  owner_name?:     string | null
}
