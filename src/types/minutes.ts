// ============================================================
// TIPOS — Módulo Atas de Reunião
// ============================================================

export type MeetingStatus = 'draft' | 'published'
export type ParticipantRole = 'organizer' | 'participant' | 'absent'
export type ActionItemStatus = 'pending' | 'in_progress' | 'done'

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  draft:     'Rascunho',
  published: 'Publicada',
}

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  organizer:   'Organizador',
  participant: 'Participante',
  absent:      'Ausente',
}

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  pending:     'Pendente',
  in_progress: 'Em Andamento',
  done:        'Concluído',
}

export const DEFAULT_MINUTES_FILTERS: MeetingMinutesFilters = {
  search:   '',
  status:   'all',
  period:   '6',
  onlyMine: false,
}

// ── Sub-shapes ────────────────────────────────────────────────

export interface MinuteUser {
  id: string
  name: string
  avatar_url: string | null
}

export interface MinuteParticipant {
  user_id: string
  role: ParticipantRole
  user: MinuteUser | null
}

export interface MinuteActionItemSummary {
  status: ActionItemStatus
}

// ── List item (joined) ────────────────────────────────────────

export interface MeetingMinuteForList {
  id:           string
  unit_id:      string
  title:        string
  meeting_date: string
  location:     string | null
  summary:      string | null
  status:       MeetingStatus
  created_by:   string
  created_at:   string
  updated_at:   string
  creator:      MinuteUser | null
  participants: MinuteParticipant[]
  action_items: MinuteActionItemSummary[]
}

// ── Filters ────────────────────────────────────────────────────

export interface MeetingMinutesFilters {
  search:   string
  status:   MeetingStatus | 'all'
  period:   '1' | '3' | '6' | '12' | 'all'
  onlyMine: boolean
}
