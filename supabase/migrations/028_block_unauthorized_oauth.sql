-- Migration 028: Block OAuth signup for unregistered emails
-- Prevents new accounts via Google OAuth if email doesn't exist in public.users
--
-- NOTE: Function is in public schema (not auth) because Supabase self-hosted
-- blocks CREATE FUNCTION on the auth schema for the postgres role.
-- The existing handle_new_user() trigger follows the same pattern.

CREATE OR REPLACE FUNCTION public.block_unauthorized_oauth_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to OAuth signups (not email/password or invite flows)
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    -- Check if email exists in public.users table
    IF NOT EXISTS (
      SELECT 1 FROM public.users WHERE email = NEW.email
    ) THEN
      -- RAISE EXCEPTION rolls back the entire transaction (including the INSERT)
      RAISE EXCEPTION 'E-mail não autorizado. Solicite acesso ao administrador do sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflict
DROP TRIGGER IF EXISTS on_auth_user_created_oauth_check ON auth.users;

-- Create trigger that fires AFTER insert on auth.users
-- Fires after on_auth_user_created (handle_new_user) — alphabetical order guarantees this
CREATE TRIGGER on_auth_user_created_oauth_check
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_unauthorized_oauth_signup();
