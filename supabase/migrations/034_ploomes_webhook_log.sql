-- Migration 034: Log de webhooks recebidos do Ploomes
-- Registra cada chamada de webhook recebida para monitoramento e debug.

CREATE TABLE IF NOT EXISTS public.ploomes_webhook_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at     timestamptz NOT NULL DEFAULT now(),
  deal_id         integer,
  action          text,              -- 'Win', 'Update', etc.
  entity          text,              -- 'Deal', etc.
  status          text NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','processing','success','error','skipped')),
  error_message   text,
  processing_ms   integer,           -- tempo de processamento em ms
  raw_payload     jsonb,             -- payload completo para debug
  sync_log_id     uuid REFERENCES public.ploomes_sync_log(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries de monitoramento
CREATE INDEX IF NOT EXISTS idx_webhook_log_received_at
  ON public.ploomes_webhook_log(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_log_status
  ON public.ploomes_webhook_log(status);

CREATE INDEX IF NOT EXISTS idx_webhook_log_deal_id
  ON public.ploomes_webhook_log(deal_id)
  WHERE deal_id IS NOT NULL;

-- RLS
ALTER TABLE public.ploomes_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_webhook_log" ON public.ploomes_webhook_log
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.ploomes_webhook_log TO authenticated;
GRANT INSERT, UPDATE ON public.ploomes_webhook_log TO service_role;
