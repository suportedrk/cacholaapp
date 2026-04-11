-- Migration 037: Remove índices duplicados + corrige roles de usuários
-- ─────────────────────────────────────────────────────────────────────

-- DB-05: Remover índices duplicados/redundantes em notifications
DROP INDEX IF EXISTS public.idx_notifications_user_read;
DROP INDEX IF EXISTS public.idx_notifications_user_id;
-- Mantido: idx_notifications_is_read (user_id, is_read) — cobre ambos os casos

-- DB-06: Corrigir brunocasaletti@gmail.com
-- role_global: vendedora → gerente
-- user_units.role: já é gerente ✓
-- is_default: false → true (Pinheiros)
UPDATE public.users
SET role = 'gerente'
WHERE email = 'brunocasaletti@gmail.com';

UPDATE public.user_units
SET is_default = true
WHERE user_id = (SELECT id FROM public.users WHERE email = 'brunocasaletti@gmail.com')
  AND unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros');

-- Corrigir permissões: de vendedora → gerente
-- Deletar permissões antigas (vendedora) e inserir as de gerente
DELETE FROM public.user_permissions
WHERE user_id = (SELECT id FROM public.users WHERE email = 'brunocasaletti@gmail.com');

INSERT INTO public.user_permissions (user_id, module, action, granted)
SELECT
  (SELECT id FROM public.users WHERE email = 'brunocasaletti@gmail.com'),
  module, action, granted
FROM public.role_default_perms
WHERE role = 'gerente';

-- DB-06: Corrigir bruno.casaletti@grupodrk.com.br
-- user_units.role: gerente → super_admin
UPDATE public.user_units
SET role = 'super_admin'
WHERE user_id = (SELECT id FROM public.users WHERE email = 'bruno.casaletti@grupodrk.com.br');

-- Definir is_default = true em Pinheiros para Bruno (grupodrk) e Vinícius
UPDATE public.user_units
SET is_default = true
WHERE user_id = (SELECT id FROM public.users WHERE email = 'bruno.casaletti@grupodrk.com.br')
  AND unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros');

UPDATE public.user_units
SET is_default = true
WHERE user_id = (SELECT id FROM public.users WHERE email = 'vinicius@festanacachola.com.br')
  AND unit_id = (SELECT id FROM public.units WHERE slug = 'pinheiros');
