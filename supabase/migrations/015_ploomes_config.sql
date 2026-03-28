-- ============================================================
-- Cachola OS — Migration 015: Ploomes Config no Banco
-- ============================================================
-- Move a configuração do pipeline/stage/status do Ploomes de
-- variáveis de ambiente para uma tabela gerenciável por unidade.
--
-- 1. Tabela `ploomes_config` — 1 row por unidade
--    Campos: pipeline_id, stage_id, won_status_id
--            field_mappings JSONB   (FieldKey → label/field/valueKey/parser)
--            contact_mappings JSONB (campo Ploomes → campo interno)
--            status_mappings JSONB  (status Ploomes → status evento)
--            webhook_url, webhook_registered_at
-- 2. RLS — apenas gestores da unidade podem ler/alterar
-- 3. Seed — Unidade Pinheiros com valores padrão
-- ============================================================
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/015_ploomes_config.sql"
-- ============================================================

-- ============================================================
-- 1. TABELA: ploomes_config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ploomes_config (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id                 UUID        NOT NULL UNIQUE REFERENCES public.units(id) ON DELETE CASCADE,

  -- Filtros de pipeline (antes em env vars)
  pipeline_id             INTEGER     NOT NULL DEFAULT 60000636,
  stage_id                INTEGER     NOT NULL DEFAULT 60004787,
  won_status_id           INTEGER     NOT NULL DEFAULT 1,

  -- Mapeamento de campos customizados (FieldKey → definição)
  -- Exemplo: { "deal_7CE92372": { "field": "eventDate", "label": "Data da Festa",
  --             "valueKey": "DateTimeValue", "parser": "date" }, ... }
  field_mappings          JSONB       NOT NULL DEFAULT '{}',

  -- Mapeamento de campos do contato (interno → chave Ploomes)
  -- Exemplo: { "clientName": "Name", "clientEmail": "Email",
  --            "clientPhone": "Phones[0].PhoneNumber" }
  contact_mappings        JSONB       NOT NULL DEFAULT '{}',

  -- Mapeamento de status do deal → status do evento
  -- Exemplo: { "Won": "confirmed", "Lost": "cancelled" }
  status_mappings         JSONB       NOT NULL DEFAULT '{}',

  -- Webhook registrado no Ploomes
  webhook_url             TEXT,
  webhook_registered_at   TIMESTAMPTZ,

  is_active               BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.set_ploomes_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ploomes_config_updated_at
  BEFORE UPDATE ON public.ploomes_config
  FOR EACH ROW EXECUTE FUNCTION public.set_ploomes_config_updated_at();

-- Índice (unit_id já é UNIQUE → índice automático)

-- ============================================================
-- 2. RLS em ploomes_config
-- ============================================================
ALTER TABLE public.ploomes_config ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin/diretor/gerente
CREATE POLICY "ploomes_config: managers can view"
  ON public.ploomes_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    )
  );

-- INSERT/UPDATE/DELETE: apenas service_role via server-side
-- (Sem policy = apenas service_role bypassa RLS)

-- ============================================================
-- 3. SEED: Pinheiros com valores padrão
-- ============================================================
INSERT INTO public.ploomes_config (
  unit_id,
  pipeline_id,
  stage_id,
  won_status_id,
  field_mappings,
  contact_mappings,
  status_mappings
)
SELECT
  u.id,
  60000636,
  60004787,
  1,
  -- field_mappings: 9 campos customizados do Ploomes
  '{
    "deal_7CE92372": { "field": "eventDate",      "label": "Data da Festa",    "valueKey": "DateTimeValue",   "parser": "date"   },
    "deal_30E82221": { "field": "startTime",      "label": "Horário Início",   "valueKey": "DateTimeValue",   "parser": "time"   },
    "deal_FD135180": { "field": "endTime",        "label": "Horário Fim",      "valueKey": "DateTimeValue",   "parser": "time"   },
    "deal_2C5D41C4": { "field": "birthdayPerson", "label": "Aniversariante",   "valueKey": "StringValue",     "parser": "string" },
    "deal_36E32E61": { "field": "age",            "label": "Idade",            "valueKey": "IntegerValue",    "parser": "number" },
    "deal_05EE1763": { "field": "guestCount",     "label": "Nº Pessoas",       "valueKey": "IntegerValue",    "parser": "number" },
    "deal_A583075F": { "field": "unitName",       "label": "Unidade",          "valueKey": "ObjectValueName", "parser": "string" },
    "deal_40C1C918": { "field": "venueName",      "label": "Casa/Espaço",      "valueKey": "ObjectValueName", "parser": "string" },
    "deal_9910A472": { "field": "theme",          "label": "Tema",             "valueKey": "StringValue",     "parser": "string" }
  }'::jsonb,
  -- contact_mappings
  '{
    "clientName":  "Name",
    "clientEmail": "Email",
    "clientPhone": "Phones[0].PhoneNumber"
  }'::jsonb,
  -- status_mappings
  '{
    "Won":  "confirmed",
    "Lost": "cancelled",
    "Open": "pending"
  }'::jsonb
FROM public.units u
WHERE u.slug = 'pinheiros'
ON CONFLICT (unit_id) DO NOTHING;
