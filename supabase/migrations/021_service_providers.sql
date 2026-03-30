-- ============================================================
-- Cachola OS — Migration 021: Prestadores de Serviços
-- ============================================================
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/021_service_providers.sql"
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

-- 1.1 Categorias de serviço configuráveis por unidade
CREATE TABLE IF NOT EXISTS service_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  icon        TEXT DEFAULT 'Briefcase',
  color       TEXT DEFAULT '#7C8D78',
  is_active   BOOLEAN DEFAULT true,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE(unit_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_service_categories_unit   ON service_categories(unit_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(unit_id, is_active);

-- 1.2 Cadastro principal do prestador
CREATE TABLE IF NOT EXISTS service_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  document_type   TEXT NOT NULL CHECK (document_type IN ('cpf', 'cnpj')),
  document_number TEXT NOT NULL,
  name            TEXT NOT NULL,
  legal_name      TEXT,

  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'blocked', 'pending_docs')),
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,

  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip_code        TEXT,
  website         TEXT,
  instagram       TEXT,

  avg_rating      NUMERIC(2,1) DEFAULT 0,
  total_events    INTEGER DEFAULT 0,

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(unit_id, document_number)
);

CREATE INDEX IF NOT EXISTS idx_service_providers_unit     ON service_providers(unit_id);
CREATE INDEX IF NOT EXISTS idx_service_providers_status   ON service_providers(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_service_providers_name     ON service_providers(unit_id, name);
CREATE INDEX IF NOT EXISTS idx_service_providers_document ON service_providers(document_number);
CREATE INDEX IF NOT EXISTS idx_service_providers_rating   ON service_providers(unit_id, avg_rating DESC);

-- 1.3 Múltiplos contatos por prestador
CREATE TABLE IF NOT EXISTS provider_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  unit_id     UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  type        TEXT NOT NULL CHECK (type IN ('phone', 'email', 'whatsapp')),
  value       TEXT NOT NULL,
  label       TEXT,
  is_primary  BOOLEAN DEFAULT false,

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_contacts_provider ON provider_contacts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_contacts_unit     ON provider_contacts(unit_id);

-- 1.4 Serviços que o prestador oferece
CREATE TABLE IF NOT EXISTS provider_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  unit_id       UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  description   TEXT,
  price_type    TEXT NOT NULL DEFAULT 'per_event'
                  CHECK (price_type IN ('per_event', 'per_hour', 'custom')),
  price_value   NUMERIC(10,2),
  currency      TEXT DEFAULT 'BRL',
  notes         TEXT,
  is_active     BOOLEAN DEFAULT true,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(provider_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_category ON provider_services(category_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_unit     ON provider_services(unit_id);

-- 1.5 Documentos com controle de vencimento
CREATE TABLE IF NOT EXISTS provider_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  unit_id       UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  doc_type      TEXT NOT NULL
                  CHECK (doc_type IN ('contract', 'license', 'certificate', 'insurance', 'id_document', 'other')),
  file_url      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,

  expires_at        DATE,
  expiry_alert_sent BOOLEAN DEFAULT false,

  uploaded_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_documents_provider ON provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_unit     ON provider_documents(unit_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_expiry   ON provider_documents(expires_at)
  WHERE expires_at IS NOT NULL;

-- 1.6 Associação festa ↔ prestador
CREATE TABLE IF NOT EXISTS event_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider_id   UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES service_categories(id) ON DELETE SET NULL,
  unit_id       UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  agreed_price  NUMERIC(10,2),
  price_type    TEXT DEFAULT 'per_event'
                  CHECK (price_type IN ('per_event', 'per_hour', 'custom')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),

  arrival_time  TIME,
  notes         TEXT,

  confirmed_by  UUID REFERENCES auth.users(id),
  confirmed_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(event_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_event_providers_event           ON event_providers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_providers_provider        ON event_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_event_providers_unit            ON event_providers(unit_id);
CREATE INDEX IF NOT EXISTS idx_event_providers_status          ON event_providers(status);
CREATE INDEX IF NOT EXISTS idx_event_providers_provider_status ON event_providers(provider_id, status)
  WHERE status IN ('pending', 'confirmed');

-- 1.7 Avaliação pós-festa
CREATE TABLE IF NOT EXISTS provider_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_provider_id UUID NOT NULL REFERENCES event_providers(id) ON DELETE CASCADE,
  provider_id       UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  unit_id           UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  rating            SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment           TEXT,

  punctuality       SMALLINT CHECK (punctuality >= 1 AND punctuality <= 5),
  quality           SMALLINT CHECK (quality >= 1 AND quality <= 5),
  professionalism   SMALLINT CHECK (professionalism >= 1 AND professionalism <= 5),

  rated_by          UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(event_provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_ratings_provider ON provider_ratings(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_event    ON provider_ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_unit     ON provider_ratings(unit_id);

-- ============================================================
-- 2. TRIGGERS — updated_at (reutiliza update_updated_at() existente)
-- ============================================================

CREATE TRIGGER set_service_categories_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_service_providers_updated_at
  BEFORE UPDATE ON service_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_provider_contacts_updated_at
  BEFORE UPDATE ON provider_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_provider_services_updated_at
  BEFORE UPDATE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_provider_documents_updated_at
  BEFORE UPDATE ON provider_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_event_providers_updated_at
  BEFORE UPDATE ON event_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_provider_ratings_updated_at
  BEFORE UPDATE ON provider_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. TRIGGER — Estatísticas do prestador (avg_rating + total_events)
-- ============================================================

CREATE OR REPLACE FUNCTION update_provider_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  v_provider_id := COALESCE(NEW.provider_id, OLD.provider_id);

  UPDATE service_providers
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM provider_ratings
      WHERE provider_id = v_provider_id
    ), 0),
    total_events = (
      SELECT COUNT(DISTINCT event_id)
      FROM event_providers
      WHERE provider_id = v_provider_id
        AND status IN ('confirmed', 'completed')
    ),
    updated_at = now()
  WHERE id = v_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na tabela de ratings (avg_rating muda)
CREATE TRIGGER trg_update_provider_stats_on_rating
  AFTER INSERT OR UPDATE OR DELETE ON provider_ratings
  FOR EACH ROW EXECUTE FUNCTION update_provider_stats();

-- Trigger na tabela de event_providers (total_events muda)
CREATE TRIGGER trg_update_provider_stats_on_event
  AFTER INSERT OR UPDATE OF status OR DELETE ON event_providers
  FOR EACH ROW EXECUTE FUNCTION update_provider_stats();

-- ============================================================
-- 4. EXPANDIR CHECK CONSTRAINT do módulo para incluir 'providers'
-- ============================================================

ALTER TABLE public.role_default_perms
  DROP CONSTRAINT IF EXISTS role_default_perms_module_check;

ALTER TABLE public.role_default_perms
  ADD CONSTRAINT role_default_perms_module_check
  CHECK (module IN (
    'events', 'maintenance', 'checklists', 'users', 'reports',
    'audit_logs', 'notifications', 'settings', 'providers'
  ));

-- ============================================================
-- 5. PERMISSÕES PADRÃO POR ROLE (módulo 'providers')
-- ============================================================

-- super_admin: acesso total
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('super_admin', 'providers', 'view',   TRUE),
  ('super_admin', 'providers', 'create', TRUE),
  ('super_admin', 'providers', 'edit',   TRUE),
  ('super_admin', 'providers', 'delete', TRUE),
  ('super_admin', 'providers', 'export', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- diretor: visualizar e exportar
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('diretor', 'providers', 'view',   TRUE),
  ('diretor', 'providers', 'export', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- gerente: gestão completa (sem delete)
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('gerente', 'providers', 'view',   TRUE),
  ('gerente', 'providers', 'create', TRUE),
  ('gerente', 'providers', 'edit',   TRUE),
  ('gerente', 'providers', 'export', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- vendedora: visualizar (para associar prestadores a eventos)
INSERT INTO public.role_default_perms (role, module, action, granted) VALUES
  ('vendedora', 'providers', 'view', TRUE)
ON CONFLICT (role, module, action) DO NOTHING;

-- ============================================================
-- 6. RLS POLICIES
-- NOTE: is_global_viewer() e get_user_unit_ids() não recebem
--       argumentos — obtêm auth.uid() internamente (SECURITY DEFINER)
-- ============================================================

-- 6.1 service_categories
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_categories_select" ON service_categories
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "service_categories_insert" ON service_categories
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "service_categories_update" ON service_categories
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "service_categories_delete" ON service_categories
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- 6.2 service_providers
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_providers_select" ON service_providers
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "service_providers_insert" ON service_providers
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "service_providers_update" ON service_providers
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "service_providers_delete" ON service_providers
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- 6.3 provider_contacts
ALTER TABLE provider_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_contacts_select" ON provider_contacts
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_contacts_insert" ON provider_contacts
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "provider_contacts_update" ON provider_contacts
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_contacts_delete" ON provider_contacts
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- 6.4 provider_services
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_services_select" ON provider_services
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_services_insert" ON provider_services
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "provider_services_update" ON provider_services
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_services_delete" ON provider_services
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- 6.5 provider_documents
ALTER TABLE provider_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_documents_select" ON provider_documents
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_documents_insert" ON provider_documents
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "provider_documents_update" ON provider_documents
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_documents_delete" ON provider_documents
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- 6.6 event_providers
ALTER TABLE event_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_providers_select" ON event_providers
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "event_providers_insert" ON event_providers
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "event_providers_update" ON event_providers
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "event_providers_delete" ON event_providers
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- 6.7 provider_ratings
ALTER TABLE provider_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_ratings_select" ON provider_ratings
  FOR SELECT USING (
    check_permission(auth.uid(), 'providers', 'view')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_ratings_insert" ON provider_ratings
  FOR INSERT WITH CHECK (
    check_permission(auth.uid(), 'providers', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

CREATE POLICY "provider_ratings_update" ON provider_ratings
  FOR UPDATE USING (
    check_permission(auth.uid(), 'providers', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

CREATE POLICY "provider_ratings_delete" ON provider_ratings
  FOR DELETE USING (
    check_permission(auth.uid(), 'providers', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- ============================================================
-- 7. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-documents',
  'provider-documents',
  false,
  20971520,  -- 20MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "provider_docs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');

CREATE POLICY "provider_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');

CREATE POLICY "provider_docs_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');

CREATE POLICY "provider_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');

-- ============================================================
-- 8. SEED — Categorias padrão para Buffet Infantil (Pinheiros)
-- ============================================================

DO $$
DECLARE
  v_unit_id UUID := '61b94ee5-ed89-4671-baf0-3475f7cdaf0f';
BEGIN
  INSERT INTO service_categories (unit_id, name, slug, description, icon, color, sort_order) VALUES
    (v_unit_id, 'DJ / Sonorização',     'dj',            'DJ e serviços de som para festas',                'Music',           '#7C8D78', 1),
    (v_unit_id, 'Fotógrafo',            'fotografo',     'Fotografia profissional para eventos',            'Camera',          '#3B82F6', 2),
    (v_unit_id, 'Filmagem',             'filmagem',      'Filmagem e edição de vídeo',                      'Video',           '#8B5CF6', 3),
    (v_unit_id, 'Mágico / Animador',    'magico',        'Mágicos, palhaços e animadores infantis',         'Wand2',           '#F59E0B', 4),
    (v_unit_id, 'Decoração',            'decoracao',     'Decoração temática e personalizada',              'Palette',         '#EC4899', 5),
    (v_unit_id, 'Bolo e Doces',         'bolo-doces',    'Bolo personalizado e mesa de doces',              'Cake',            '#EF4444', 6),
    (v_unit_id, 'Buffet / Alimentação', 'buffet',        'Serviços de alimentação terceirizados',           'UtensilsCrossed', '#F97316', 7),
    (v_unit_id, 'Recreação',            'recreacao',     'Monitores de recreação, brinquedos e atividades', 'Users',           '#22C55E', 8),
    (v_unit_id, 'Personagem Vivo',      'personagem',    'Personagens temáticos para festas (cosplay)',      'Drama',           '#A855F7', 9),
    (v_unit_id, 'Show / Banda',         'show-banda',    'Shows musicais, bandas e artistas ao vivo',       'Mic2',            '#06B6D4', 10),
    (v_unit_id, 'Segurança',            'seguranca',     'Segurança particular para eventos',               'Shield',          '#64748B', 11),
    (v_unit_id, 'Limpeza',              'limpeza',       'Serviços de limpeza pós-evento',                  'Sparkles',        '#78716C', 12),
    (v_unit_id, 'Outros',               'outros',        'Demais serviços não categorizados',               'Briefcase',       '#9CA3AF', 99)
  ON CONFLICT (unit_id, slug) DO NOTHING;
END $$;
