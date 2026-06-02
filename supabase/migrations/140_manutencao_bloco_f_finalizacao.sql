-- supabase/migrations/140_manutencao_bloco_f_finalizacao.sql
-- Bloco F — Finalização do chamado.
--
--   1. resolution_notes (descrição do que foi realizado) + concluded_by_user_id
--      (quem concluiu — carimbado por trigger, à prova de adulteração).
--   2. phase em maintenance_ticket_photos: 'abertura' | 'conclusao' — distingue
--      fotos do registro inicial das fotos do serviço concluído.
--   3. Trigger BEFORE UPDATE que carimba concluded_by_user_id = auth.uid() quando
--      o status transita para 'concluded'. NÃO toca concluded_at (valor editável
--      preenchido pelo responsável).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. resolution_notes + concluded_by_user_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS concluded_by_user_id uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.maintenance_tickets.resolution_notes IS
  'Descrição do que foi realizado, preenchida na finalização do chamado.';
COMMENT ON COLUMN public.maintenance_tickets.concluded_by_user_id IS
  'Quem concluiu o chamado (auth.uid() carimbado por trigger na transição para concluded).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. phase nas fotos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_ticket_photos
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'abertura'
  CHECK (phase IN ('abertura', 'conclusao'));

COMMENT ON COLUMN public.maintenance_ticket_photos.phase IS
  'Fase da foto: abertura (registro inicial) ou conclusao (serviço concluído).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: carimba concluded_by_user_id na transição para 'concluded'
-- ─────────────────────────────────────────────────────────────────────────────
-- Só no momento em que status passa a 'concluded' (anti-spoofing: ignora valor
-- enviado pelo client). NÃO altera concluded_at — esse é o valor editável que o
-- responsável preencheu. auth.uid() NULL (seed/service-role) → aceita NULL.
CREATE OR REPLACE FUNCTION public.set_ticket_concluded_by()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluded' AND OLD.status IS DISTINCT FROM 'concluded' THEN
    NEW.concluded_by_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_concluded_by
  BEFORE UPDATE OF status ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_concluded_by();

COMMIT;
