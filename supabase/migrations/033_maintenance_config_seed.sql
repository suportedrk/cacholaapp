-- ============================================================
-- Migration 033: Seeds de configuração padrão para Manutenção
-- Idempotente: só insere onde ainda não há dados
-- ============================================================

-- ── SETORES PADRÃO ──────────────────────────────────────────
-- Inserir apenas para unidades que ainda não têm nenhum setor
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM public.units WHERE is_active = true LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.maintenance_sectors WHERE unit_id = u.id
    ) THEN
      INSERT INTO public.maintenance_sectors (unit_id, name, sort_order) VALUES
        (u.id, 'Cozinha',         1),
        (u.id, 'Salão Principal', 2),
        (u.id, 'Banheiros',       3),
        (u.id, 'Área Externa',    4),
        (u.id, 'Recepção',        5),
        (u.id, 'Depósito',        6),
        (u.id, 'Escritório',      7),
        (u.id, 'Playground',      8);
    END IF;
  END LOOP;
END;
$$;

-- ── CATEGORIAS PADRÃO ────────────────────────────────────────
-- Inserir apenas para unidades que ainda não têm nenhuma categoria
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM public.units WHERE is_active = true LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.maintenance_categories WHERE unit_id = u.id
    ) THEN
      INSERT INTO public.maintenance_categories (unit_id, name, icon, color, sort_order) VALUES
        (u.id, 'Elétrica',        'zap',             '#F59E0B', 1),
        (u.id, 'Hidráulica',      'droplets',        '#3B82F6', 2),
        (u.id, 'Limpeza',         'sparkles',        '#22C55E', 3),
        (u.id, 'Estrutural',      'building',        '#71717A', 4),
        (u.id, 'Equipamentos',    'wrench',          '#F97316', 5),
        (u.id, 'TI / Tecnologia', 'monitor',         '#8B5CF6', 6),
        (u.id, 'Outros',          'more-horizontal', '#71717A', 7);
    END IF;
  END LOOP;
END;
$$;

-- ── SLA PADRÃO ───────────────────────────────────────────────
-- UNIQUE(unit_id, urgency_level) → ON CONFLICT DO NOTHING
INSERT INTO public.maintenance_sla (unit_id, urgency_level, response_hours, resolution_hours)
SELECT u.id, levels.urgency_level, levels.response_hours, levels.resolution_hours
FROM public.units u
CROSS JOIN (VALUES
  ('critical', 1,   4  ),
  ('high',     4,   24 ),
  ('medium',   24,  72 ),
  ('low',      72,  168)
) AS levels(urgency_level, response_hours, resolution_hours)
WHERE u.is_active = true
ON CONFLICT (unit_id, urgency_level) DO NOTHING;
