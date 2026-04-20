-- ===========================================================
-- anonymize-local.sql — Anonimização LGPD para banco local
-- NUNCA executar em produção — proteção via \if abaixo.
-- Executar via sync-db-local.sh (passa -v LOCAL_TOKEN=1).
-- ===========================================================

\if :{?LOCAL_TOKEN}
\else
  \warn 'ABORT: LOCAL_TOKEN não definido. Este script só deve ser executado localmente via sync-db-local.sh.'
  \quit
\endif

BEGIN;

-- ─── TRUNCATE: texto livre (poucos registros, zero valor para dev) ───────────

-- CASCADE propaga para filhos (meeting_action_items + meeting_participants)
TRUNCATE TABLE public.meeting_minutes CASCADE;
TRUNCATE TABLE public.notifications;
TRUNCATE TABLE public.checklist_item_comments;
-- CASCADE propaga para maintenance_ticket_photos
TRUNCATE TABLE public.maintenance_tickets CASCADE;

-- ─── events ─────────────────────────────────────────────────────────────────
UPDATE public.events SET
  title          = '(' || to_char(date, 'MM/YYYY') || ') Festa ' || upper(left(md5(id::text || 'title'), 6)),
  client_name    = 'Cliente ' || upper(left(md5(id::text), 6)),
  client_phone   = CASE WHEN client_phone IS NOT NULL
                   THEN '(11) 9' || lpad((abs(hashtext(id::text)) % 80000000 + 10000000)::text, 8, '0')
                   END,
  client_email   = CASE WHEN client_email IS NOT NULL
                   THEN left(md5(lower(trim(client_email))), 12) || '@dev.local'
                   END,
  birthday_person = CASE WHEN birthday_person IS NOT NULL
                   THEN 'Aniv ' || upper(left(md5(id::text || 'f'), 4))
                   END,
  -- D1: data fake determinística em faixa plausível para criança (3-10 anos)
  birthday_date  = CASE WHEN birthday_date IS NOT NULL
                   THEN (DATE '2014-01-01' + (abs(hashtext(id::text)) % 3650) * INTERVAL '1 day')::date
                   END,
  father_name    = CASE WHEN father_name IS NOT NULL
                   THEN 'Responsavel ' || upper(left(md5(id::text || 'fn'), 6))
                   END,
  event_location = NULL,
  school         = NULL,
  notes          = NULL,
  briefing       = NULL;

-- ─── ploomes_deals ───────────────────────────────────────────────────────────
UPDATE public.ploomes_deals SET
  title         = 'Lead #' || ploomes_deal_id::text,
  contact_name  = 'Cliente ' || upper(left(md5(id::text), 6)),
  contact_email = CASE WHEN contact_email IS NOT NULL
                  THEN left(md5(lower(trim(contact_email))), 12) || '@dev.local'
                  END,
  contact_phone = CASE WHEN contact_phone IS NOT NULL
                  THEN '(11) 9' || lpad((abs(hashtext(id::text)) % 80000000 + 10000000)::text, 8, '0')
                  END,
  -- D1: data fake — módulo Recompra continua funcional localmente
  aniversariante_birthday = CASE WHEN aniversariante_birthday IS NOT NULL
                            THEN (DATE '2014-01-01' + (abs(hashtext(id::text || 'bd')) % 3650) * INTERVAL '1 day')::date
                            END;

-- ─── ploomes_contacts ────────────────────────────────────────────────────────

-- ─── ploomes_contacts ────────────────────────────────────────────────────────

-- Passo 1: fake birthday (precisa ser feito antes de calcular anniversaries)
UPDATE public.ploomes_contacts SET
  birthday = CASE WHEN birthday IS NOT NULL
             THEN (DATE '2014-01-01' + (abs(hashtext(id::text)) % 3650) * INTERVAL '1 day')::date
             END;

-- Passo 2: recalcular anniversaries a partir do birthday fake
-- next_anniversary é consumido pelo get_upsell_opportunities RPC — não pode ser NULL
UPDATE public.ploomes_contacts SET
  next_anniversary = CASE
    WHEN birthday IS NULL THEN NULL
    WHEN (birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birthday)) * INTERVAL '1 year')::date >= CURRENT_DATE
    THEN (birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birthday)) * INTERVAL '1 year')::date
    ELSE (birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birthday) + 1) * INTERVAL '1 year')::date
  END,
  previous_anniversary = CASE
    WHEN birthday IS NULL THEN NULL
    WHEN (birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birthday)) * INTERVAL '1 year')::date < CURRENT_DATE
    THEN (birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birthday)) * INTERVAL '1 year')::date
    ELSE (birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birthday) - 1) * INTERVAL '1 year')::date
  END;

-- Passo 3: demais campos PII
UPDATE public.ploomes_contacts SET
  name       = 'Cliente ' || upper(left(md5(id::text), 6)),
  legal_name = NULL,
  -- D6: seed pelo valor real → mesmo email aparece idêntico em ploomes_deals e recompra_contact_log
  email      = CASE WHEN email IS NOT NULL
               THEN left(md5(lower(trim(email))), 12) || '@dev.local'
               END,
  -- JSONB: substitui PhoneNumber dentro de cada elemento do array
  phones     = CASE
    WHEN phones IS NULL OR jsonb_array_length(phones) = 0 THEN phones
    ELSE (
      SELECT jsonb_agg(
        elem
        - 'PhoneNumber'
        - 'SearchPhoneNumber'
        || jsonb_build_object(
          'PhoneNumber',
          '(11) 9' || lpad(
            (abs(hashtext(id::text || coalesce(elem->>'Id', '0'))) % 80000000 + 10000000)::text,
            8, '0'
          ),
          'SearchPhoneNumber', 0
        )
      )
      FROM jsonb_array_elements(phones) elem
    )
  END;

-- ─── ploomes_orders ──────────────────────────────────────────────────────────
UPDATE public.ploomes_orders SET
  contact_name = CASE WHEN contact_name IS NOT NULL
                 THEN 'Cliente ' || upper(left(md5(ploomes_order_id::text), 6))
                 END,
  -- D6: fake mas consistente cross-table (joins vendedora → order mantidos)
  owner_email  = CASE WHEN owner_email IS NOT NULL
                 THEN left(md5(lower(trim(owner_email))), 12) || '@dev.local'
                 END;

-- ─── pre_reservas_diretoria ──────────────────────────────────────────────────
UPDATE public.pre_reservas_diretoria SET
  client_name    = 'Cliente ' || upper(left(md5(id::text), 6)),
  client_contact = '(11) 9' || lpad((abs(hashtext(id::text)) % 80000000 + 10000000)::text, 8, '0'),
  description    = NULL;

-- ─── users (staff interno) ───────────────────────────────────────────────────
-- name: KEEP (D3) — útil para debug
-- email: fake com role preservada no endereço
UPDATE public.users SET
  email      = role || '_' || left(id::text, 8) || '@dev.local',
  phone      = NULL,
  avatar_url = NULL;

-- ─── sellers ─────────────────────────────────────────────────────────────────
-- name: KEEP (D3) — fundamental para BI e checklist comercial
UPDATE public.sellers SET
  email     = NULL,
  photo_url = NULL,
  notes     = NULL;

-- ─── service_providers (B2B / MEI) ───────────────────────────────────────────
UPDATE public.service_providers SET
  name            = 'Fornecedor ' || upper(left(md5(id::text), 6)) || ' Ltda',
  legal_name      = NULL,
  document_number = lpad((abs(hashtext(id::text)) % 99999999)::text, 8, '0') || '/0001-00',
  address         = NULL,
  zip_code        = NULL,
  website         = NULL,
  instagram       = NULL,
  notes           = NULL;

-- ─── provider_contacts ───────────────────────────────────────────────────────
UPDATE public.provider_contacts SET
  value = CASE type
    WHEN 'email'    THEN left(md5(id::text || 'em'), 12) || '@dev.local'
    WHEN 'phone'    THEN '(11) 9' || lpad((abs(hashtext(id::text)) % 80000000 + 10000000)::text, 8, '0')
    WHEN 'whatsapp' THEN '(11) 9' || lpad((abs(hashtext(id::text || 'wa')) % 80000000 + 10000000)::text, 8, '0')
    ELSE left(md5(id::text), 16)
  END,
  label = NULL;

-- ─── upsell_contact_log ──────────────────────────────────────────────────────
UPDATE public.upsell_contact_log SET
  notes = NULL;

-- ─── recompra_contact_log ────────────────────────────────────────────────────
UPDATE public.recompra_contact_log SET
  -- D6: seed pelo valor real → consistente com ploomes_contacts.email
  contact_email           = CASE WHEN contact_email IS NOT NULL
                            THEN left(md5(lower(trim(contact_email))), 12) || '@dev.local'
                            END,
  -- D1: data fake — módulo Recompra funcional localmente
  aniversariante_birthday = CASE WHEN aniversariante_birthday IS NOT NULL
                            THEN (DATE '2014-01-01' + (abs(hashtext(id::text || 'rc')) % 3650) * INTERVAL '1 day')::date
                            END,
  notes = NULL;

COMMIT;

-- ─── Permissões schema public (pg_restore --no-acl apaga os GRANTs originais) ──
-- Necessário para que o Supabase anon/authenticated consiga acessar as tabelas localmente.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

\echo 'Anonimizacao LGPD concluida com sucesso.'
