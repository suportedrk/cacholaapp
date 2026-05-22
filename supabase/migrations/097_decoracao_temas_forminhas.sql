-- ============================================================
-- Migration 097 — Módulo Decoração: Temas e Forminhas (fundação)
-- Cria as 3 tabelas-catálogo GLOBAIS do módulo Decoração, registra
-- o módulo 'decoracao' no RBAC, concede permissões e faz o seed.
--
-- Tabelas globais (sem unit_id) — catálogo padrão da empresa,
-- vale igual para Pinheiros e Moema.
--
-- RBAC:
--   view/create/edit → super_admin, diretor, gerente, decoracao
--   delete           → super_admin, diretor
--
-- Rollback: 097_decoracao_temas_forminhas_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. TABELAS ───────────────────────────────────────────────

-- Legenda das 26 cores de forminha (numero + nome + cor + foto opcional).
CREATE TABLE IF NOT EXISTS public.decoracao_forminha_cores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero     integer     NOT NULL UNIQUE CHECK (numero BETWEEN 1 AND 26),
  nome       text        NOT NULL,
  cor_hex    text,                       -- nullable: NULL = cor ainda não definida
  foto_url   text,                       -- upload deferido para micro-passo separado
  ativo      boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo visual de temas de festa.
CREATE TABLE IF NOT EXISTS public.decoracao_temas (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text        NOT NULL,
  categoria          text,                       -- nullable: preenchido na tela
  ativo              boolean     NOT NULL DEFAULT true,
  foto_url           text,                       -- upload deferido
  observacoes        text,
  personalizado      boolean     NOT NULL DEFAULT false,
  decoradora_externa boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Vínculo N-para-N tema ↔ cor de forminha.
CREATE TABLE IF NOT EXISTS public.decoracao_tema_forminhas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id         uuid        NOT NULL REFERENCES public.decoracao_temas(id) ON DELETE CASCADE,
  forminha_cor_id uuid        NOT NULL REFERENCES public.decoracao_forminha_cores(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tema_id, forminha_cor_id)
);

CREATE INDEX IF NOT EXISTS idx_decoracao_tema_forminhas_tema
  ON public.decoracao_tema_forminhas (tema_id);
CREATE INDEX IF NOT EXISTS idx_decoracao_tema_forminhas_cor
  ON public.decoracao_tema_forminhas (forminha_cor_id);

-- ── 2. TRIGGERS updated_at (reutiliza update_updated_at()) ────

CREATE OR REPLACE TRIGGER trg_decoracao_forminha_cores_updated_at
  BEFORE UPDATE ON public.decoracao_forminha_cores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER trg_decoracao_temas_updated_at
  BEFORE UPDATE ON public.decoracao_temas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- Módulo global. check_permission() é de 3 argumentos (user, module, action).
-- view  → quem tem permissão 'decoracao' (super_admin/diretor via is_global_viewer
--          também, como rede de segurança).
-- create/edit/delete → conforme grants do passo 5.
-- No vínculo tema↔forminha, INSERT/DELETE são gated por 'edit': gerenciar a
-- composição de cores de um tema é editar o tema, não criar/excluir cadastro.

ALTER TABLE public.decoracao_forminha_cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decoracao_temas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decoracao_tema_forminhas ENABLE ROW LEVEL SECURITY;

-- decoracao_forminha_cores
DROP POLICY IF EXISTS "decoracao_forminha_cores: view"   ON public.decoracao_forminha_cores;
DROP POLICY IF EXISTS "decoracao_forminha_cores: create" ON public.decoracao_forminha_cores;
DROP POLICY IF EXISTS "decoracao_forminha_cores: edit"   ON public.decoracao_forminha_cores;
DROP POLICY IF EXISTS "decoracao_forminha_cores: delete" ON public.decoracao_forminha_cores;

CREATE POLICY "decoracao_forminha_cores: view" ON public.decoracao_forminha_cores
  FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_forminha_cores: create" ON public.decoracao_forminha_cores
  FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_forminha_cores: edit" ON public.decoracao_forminha_cores
  FOR UPDATE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_forminha_cores: delete" ON public.decoracao_forminha_cores
  FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- decoracao_temas
DROP POLICY IF EXISTS "decoracao_temas: view"   ON public.decoracao_temas;
DROP POLICY IF EXISTS "decoracao_temas: create" ON public.decoracao_temas;
DROP POLICY IF EXISTS "decoracao_temas: edit"   ON public.decoracao_temas;
DROP POLICY IF EXISTS "decoracao_temas: delete" ON public.decoracao_temas;

CREATE POLICY "decoracao_temas: view" ON public.decoracao_temas
  FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_temas: create" ON public.decoracao_temas
  FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_temas: edit" ON public.decoracao_temas
  FOR UPDATE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_temas: delete" ON public.decoracao_temas
  FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- decoracao_tema_forminhas (vínculo)
DROP POLICY IF EXISTS "decoracao_tema_forminhas: view"   ON public.decoracao_tema_forminhas;
DROP POLICY IF EXISTS "decoracao_tema_forminhas: create" ON public.decoracao_tema_forminhas;
DROP POLICY IF EXISTS "decoracao_tema_forminhas: delete" ON public.decoracao_tema_forminhas;

CREATE POLICY "decoracao_tema_forminhas: view" ON public.decoracao_tema_forminhas
  FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_tema_forminhas: create" ON public.decoracao_tema_forminhas
  FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_tema_forminhas: delete" ON public.decoracao_tema_forminhas
  FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'edit'));

-- ── 4. REGISTRAR MÓDULO NO CATÁLOGO RBAC ─────────────────────

INSERT INTO public.modules (code, label, description, icon, sort_order, is_active)
VALUES ('decoracao', 'Decoração', 'Catálogo de temas e cores de forminhas', 'Palette', 95, true)
ON CONFLICT (code) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active;

-- ── 5. GRANTS DE PERMISSÃO ───────────────────────────────────

-- 5a. role_permissions — template canônico (applyRoleTemplate + /admin/cargos)
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
SELECT roles.r, 'decoracao', acts.a, true
FROM (VALUES ('super_admin'), ('diretor')) AS roles(r)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS acts(a)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO public.role_permissions (role_code, module_code, action, granted)
SELECT roles.r, 'decoracao', acts.a, true
FROM (VALUES ('gerente'), ('decoracao')) AS roles(r)
CROSS JOIN (VALUES ('view'), ('create'), ('edit')) AS acts(a)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;

-- 5b. role_default_perms — template legado (seed-local-test-users.ts)
INSERT INTO public.role_default_perms (role, module, action, granted)
SELECT roles.r, 'decoracao', acts.a, true
FROM (VALUES ('super_admin'), ('diretor')) AS roles(r)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS acts(a)
ON CONFLICT (role, module, action) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO public.role_default_perms (role, module, action, granted)
SELECT roles.r, 'decoracao', acts.a, true
FROM (VALUES ('gerente'), ('decoracao')) AS roles(r)
CROSS JOIN (VALUES ('view'), ('create'), ('edit')) AS acts(a)
ON CONFLICT (role, module, action) DO UPDATE SET granted = EXCLUDED.granted;

-- 5c. user_permissions — backfill dos usuários EXISTENTES.
-- Módulo global → unit_id NULL. check_permission() ignora unit_id.
INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted)
SELECT u.id, 'decoracao', acts.a, NULL, true
FROM public.users u
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS acts(a)
WHERE u.role IN ('super_admin', 'diretor')
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted)
SELECT u.id, 'decoracao', acts.a, NULL, true
FROM public.users u
CROSS JOIN (VALUES ('view'), ('create'), ('edit')) AS acts(a)
WHERE u.role IN ('gerente', 'decoracao')
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ── 6. SEED — 26 cores de forminha ───────────────────────────
-- Sem cor (cor_hex NULL) e nome placeholder; editados na tela.
INSERT INTO public.decoracao_forminha_cores (numero, nome, cor_hex)
SELECT n, 'Forminha ' || n, NULL
FROM generate_series(1, 26) AS n
ON CONFLICT (numero) DO NOTHING;

-- ── 7. SEED — 32 temas padrão ────────────────────────────────
-- Guard: só semeia se a tabela estiver vazia (idempotência).
INSERT INTO public.decoracao_temas (nome, observacoes)
SELECT v.nome, v.obs
FROM (VALUES
  ('ABELHINHAS',                 NULL),
  ('BARBIE',                     NULL),
  ('CACHORROS',                  NULL),
  ('CARROS DISNEY',              NULL),
  ('CASA MAGICA DA GABBY',       NULL),
  ('CINDERELLA',                 NULL),
  ('CIRCO',                      NULL),
  ('DINOSSAURO',                 NULL),
  ('DIVERTIDAMENTE',             '3 se for festa de menino, 8 se for festa de menina'),
  ('ESPORTES',                   NULL),
  ('FAZENDINHA',                 NULL),
  ('FROZEN',                     NULL),
  ('FUNDO DO MAR',               NULL),
  ('HARRY POTTER',               NULL),
  ('HELLO KITTY',                NULL),
  ('HEROIS',                     NULL),
  ('HOT WHEELS',                 NULL),
  ('LEGO ESPACIAL',              NULL),
  ('LILO E STITCH',              NULL),
  ('LILO E STITCH (variação 2)', NULL),
  ('MARIO BROS',                 NULL),
  ('MINECRAFT',                  NULL),
  ('MORANGUINHO',                NULL),
  ('PATRULHA CANINA',            NULL),
  ('PEPPA PIG',                  NULL),
  ('PEQUENO PRINCIPE',           NULL),
  ('SAFARI',                     NULL),
  ('SONIC',                      NULL),
  ('TOY STORY',                  NULL),
  ('TRANSPORTES',                NULL),
  ('UNICORNIO',                  NULL),
  ('VOLTA AO SOL',               NULL)
) AS v(nome, obs)
WHERE NOT EXISTS (SELECT 1 FROM public.decoracao_temas);

-- ── 8. SEED — vínculos tema ↔ forminha ───────────────────────
-- Resolve IDs por JOIN (nome do tema × numero da forminha) — zero UUID hardcoded.
INSERT INTO public.decoracao_tema_forminhas (tema_id, forminha_cor_id)
SELECT t.id, f.id
FROM (VALUES
  ('ABELHINHAS', 11), ('ABELHINHAS', 12), ('ABELHINHAS', 15), ('ABELHINHAS', 25),
  ('BARBIE', 8), ('BARBIE', 11), ('BARBIE', 22),
  ('CACHORROS', 5), ('CACHORROS', 8), ('CACHORROS', 12), ('CACHORROS', 14),
  ('CARROS DISNEY', 2), ('CARROS DISNEY', 3), ('CARROS DISNEY', 4), ('CARROS DISNEY', 9),
  ('CASA MAGICA DA GABBY', 11), ('CASA MAGICA DA GABBY', 12), ('CASA MAGICA DA GABBY', 14), ('CASA MAGICA DA GABBY', 22),
  ('CINDERELLA', 12), ('CINDERELLA', 14), ('CINDERELLA', 21),
  ('CIRCO', 1), ('CIRCO', 3), ('CIRCO', 20),
  ('DINOSSAURO', 5), ('DINOSSAURO', 24), ('DINOSSAURO', 25),
  ('DIVERTIDAMENTE', 3), ('DIVERTIDAMENTE', 8), ('DIVERTIDAMENTE', 9), ('DIVERTIDAMENTE', 17), ('DIVERTIDAMENTE', 22), ('DIVERTIDAMENTE', 25),
  ('ESPORTES', 5), ('ESPORTES', 18), ('ESPORTES', 24),
  ('FAZENDINHA', 3), ('FAZENDINHA', 5), ('FAZENDINHA', 12), ('FAZENDINHA', 26),
  ('FROZEN', 1), ('FROZEN', 14), ('FROZEN', 20),
  ('FUNDO DO MAR', 5), ('FUNDO DO MAR', 14), ('FUNDO DO MAR', 17), ('FUNDO DO MAR', 25),
  ('HARRY POTTER', 3), ('HARRY POTTER', 4), ('HARRY POTTER', 5),
  ('HELLO KITTY', 3), ('HELLO KITTY', 8), ('HELLO KITTY', 11),
  ('HEROIS', 3), ('HEROIS', 17), ('HEROIS', 23), ('HEROIS', 24),
  ('HOT WHEELS', 4), ('HOT WHEELS', 5), ('HOT WHEELS', 18), ('HOT WHEELS', 20), ('HOT WHEELS', 25),
  ('LEGO ESPACIAL', 14), ('LEGO ESPACIAL', 20), ('LEGO ESPACIAL', 22),
  ('LILO E STITCH', 12), ('LILO E STITCH', 14), ('LILO E STITCH', 18), ('LILO E STITCH', 20), ('LILO E STITCH', 25),
  ('LILO E STITCH (variação 2)', 17), ('LILO E STITCH (variação 2)', 21), ('LILO E STITCH (variação 2)', 22), ('LILO E STITCH (variação 2)', 25),
  ('MARIO BROS', 3), ('MARIO BROS', 9), ('MARIO BROS', 23), ('MARIO BROS', 24),
  ('MINECRAFT', 5), ('MINECRAFT', 24), ('MINECRAFT', 25),
  ('MORANGUINHO', 3), ('MORANGUINHO', 11), ('MORANGUINHO', 25),
  ('PATRULHA CANINA', 12), ('PATRULHA CANINA', 14), ('PATRULHA CANINA', 17), ('PATRULHA CANINA', 18),
  ('PEPPA PIG', 8), ('PEPPA PIG', 11), ('PEPPA PIG', 12), ('PEPPA PIG', 25),
  ('PEQUENO PRINCIPE', 12), ('PEQUENO PRINCIPE', 14), ('PEQUENO PRINCIPE', 18),
  ('SAFARI', 5), ('SAFARI', 6), ('SAFARI', 12), ('SAFARI', 25),
  ('SONIC', 3), ('SONIC', 12), ('SONIC', 14), ('SONIC', 20),
  ('TOY STORY', 5), ('TOY STORY', 12), ('TOY STORY', 14), ('TOY STORY', 25),
  ('TRANSPORTES', 5), ('TRANSPORTES', 12), ('TRANSPORTES', 14), ('TRANSPORTES', 18),
  ('UNICORNIO', 11), ('UNICORNIO', 12), ('UNICORNIO', 14), ('UNICORNIO', 22),
  ('VOLTA AO SOL', 12), ('VOLTA AO SOL', 15), ('VOLTA AO SOL', 18)
) AS link(tema_nome, numero)
JOIN public.decoracao_temas t           ON t.nome   = link.tema_nome
JOIN public.decoracao_forminha_cores f  ON f.numero = link.numero
ON CONFLICT (tema_id, forminha_cor_id) DO NOTHING;

-- ── 9. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
