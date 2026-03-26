// ============================================================
// DATABASE TYPES — Cachola OS
// Este arquivo será substituído pelo gerado automaticamente
// via: npx supabase gen types typescript --local
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Placeholder — será gerado do schema após Bloco 3
export interface Database {
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
