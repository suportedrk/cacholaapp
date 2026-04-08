-- Migration 029: block inactive users from OAuth signup/re-signup
-- Atualiza block_unauthorized_oauth_signup() para também verificar is_active.
-- Cobre o caso de um usuário que foi desativado e tenta criar nova sessão OAuth.

CREATE OR REPLACE FUNCTION public.block_unauthorized_oauth_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Só aplica a logins OAuth (não e-mail/senha ou convite)
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    -- Checa se o e-mail existe E está ativo em public.users
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE email = NEW.email
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Acesso negado. Conta inativa ou não autorizada. Solicite acesso ao administrador do sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
