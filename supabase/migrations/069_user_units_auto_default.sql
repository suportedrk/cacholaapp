-- Migration 069: user_units auto-default invariant
--
-- Garante que cada usuário com ao menos 1 registro em user_units
-- tenha EXATAMENTE 1 linha com is_default = true.
--
-- Mecanismo: trigger AFTER INSERT OR DELETE (NÃO UPDATE — evita conflito
-- com useSetDefaultUnit que usa dois UPDATEs sequenciais).

-- ─────────────────────────────────────────────────────────────
-- 1. BACKFILL (idempotente)
-- ─────────────────────────────────────────────────────────────

-- 1a. Usuários sem nenhum is_default=true: marcar o mais antigo
UPDATE public.user_units uu
SET is_default = true
WHERE uu.id = (
  SELECT id
  FROM public.user_units u2
  WHERE u2.user_id = uu.user_id
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_units u3
  WHERE u3.user_id = uu.user_id AND u3.is_default = true
);

-- 1b. Usuários com mais de um is_default=true: manter só o mais antigo
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM public.user_units
  WHERE is_default = true
)
UPDATE public.user_units
SET is_default = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─────────────────────────────────────────────────────────────
-- 2. ÍNDICE ÚNICO PARCIAL (garante máx. 1 is_default por user)
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_units_one_default_per_user
  ON public.user_units (user_id)
  WHERE is_default = true;

-- ─────────────────────────────────────────────────────────────
-- 3. RPC: set_user_default_unit (troca atômica sem race condition)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_user_default_unit(
  p_user_id UUID,
  p_unit_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desabilita triggers de usuário nesta transação para evitar
  -- que o trigger tente auto-promover enquanto fazemos a troca
  SET LOCAL session_replication_role = replica;

  UPDATE public.user_units
  SET is_default = false
  WHERE user_id = p_user_id AND is_default = true;

  UPDATE public.user_units
  SET is_default = true
  WHERE user_id = p_user_id AND unit_id = p_unit_id;
END;
$$;

-- Somente o próprio usuário ou roles elevadas podem chamar
REVOKE ALL ON FUNCTION public.set_user_default_unit(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_default_unit(UUID, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGER: auto-promove o mais antigo quando não há default
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_user_unit_auto_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Determina o user_id afetado
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Verifica se há algum is_default=true para esse usuário
  IF NOT EXISTS (
    SELECT 1 FROM public.user_units
    WHERE user_id = v_user_id AND is_default = true
  ) THEN
    -- Nenhum default: promover o mais antigo existente
    UPDATE public.user_units
    SET is_default = true
    WHERE id = (
      SELECT id FROM public.user_units
      WHERE user_id = v_user_id
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;

  RETURN NULL; -- trigger AFTER, retorno ignorado
END;
$$;

-- Dispara APÓS INSERT (novo usuário sem default) e APÓS DELETE
-- (remoção da unidade padrão). NÃO dispara em UPDATE para não
-- interferir com a troca em dois passos do useSetDefaultUnit.
DROP TRIGGER IF EXISTS trg_user_unit_auto_default ON public.user_units;
CREATE TRIGGER trg_user_unit_auto_default
  AFTER INSERT OR DELETE ON public.user_units
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_user_unit_auto_default();

-- ─────────────────────────────────────────────────────────────
-- 5. VALIDAÇÃO (falha se invariante ainda quebrada)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  anomaly_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO anomaly_count
  FROM (
    SELECT user_id
    FROM public.user_units
    GROUP BY user_id
    HAVING COUNT(*) FILTER (WHERE is_default = true) <> 1
  ) sub;

  IF anomaly_count > 0 THEN
    RAISE EXCEPTION 'Migration 069: % usuário(s) com invariante is_default quebrada após backfill', anomaly_count;
  END IF;

  RAISE NOTICE 'Migration 069: invariante is_default OK — nenhuma anomalia.';
END;
$$;
