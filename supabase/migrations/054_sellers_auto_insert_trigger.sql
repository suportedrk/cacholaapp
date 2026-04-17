-- =============================================================
-- Migration 054: Trigger de auto-insert em sellers
-- Toda vez que um novo owner_id aparecer em ploomes_orders,
-- insere automaticamente na tabela sellers (se ainda não existir)
-- =============================================================

-- ── Função SECURITY DEFINER ────────────────────────────────────
-- Precisa bypassar RLS de sellers (INSERT só permite super_admin/diretor)
CREATE OR REPLACE FUNCTION auto_insert_seller_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ignora se owner_id ou owner_name estiverem ausentes
  IF NEW.owner_id IS NULL OR NEW.owner_name IS NULL OR TRIM(NEW.owner_name) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO sellers (owner_id, name, status, hire_date)
  VALUES (
    NEW.owner_id,
    NEW.owner_name,
    'active',
    CASE
      WHEN NEW.ploomes_create_date IS NOT NULL THEN DATE(NEW.ploomes_create_date)
      ELSE NULL
    END
  )
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Garante que a função é owned por um superuser (para SECURITY DEFINER funcionar)
ALTER FUNCTION auto_insert_seller_from_order() OWNER TO supabase_admin;

-- ── Trigger ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auto_insert_seller ON ploomes_orders;
CREATE TRIGGER trg_auto_insert_seller
  AFTER INSERT ON ploomes_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_seller_from_order();

-- ── Backfill de segurança ──────────────────────────────────────
-- Garante que qualquer order que chegou antes deste trigger
-- já tem um seller correspondente (ON CONFLICT = idempotente)
INSERT INTO sellers (owner_id, name, status, hire_date)
SELECT DISTINCT ON (po.owner_id)
  po.owner_id,
  po.owner_name,
  'active',
  (
    SELECT MIN(DATE(po2.ploomes_create_date))
    FROM ploomes_orders po2
    WHERE po2.owner_id = po.owner_id
  )
FROM ploomes_orders po
WHERE po.owner_id IS NOT NULL
  AND po.owner_name IS NOT NULL
  AND TRIM(po.owner_name) <> ''
ON CONFLICT (owner_id) DO NOTHING;
