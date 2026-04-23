/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          SCRIPT DE USO EXCLUSIVO EM AMBIENTE LOCAL DE DESENVOLVIMENTO    ║
 * ║                                                                          ║
 * ║  ⚠️  NUNCA rodar em produção.                                            ║
 * ║  ⚠️  NUNCA commitar em main.                                             ║
 * ║  ⚠️  APAGA todos os usuários (exceto admin@cachola.local).               ║
 * ║                                                                          ║
 * ║  Uso: npx tsx scripts/seed-local-test-users.ts                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Cria 10 usuários de teste — um por role — para validação de guards e
 * permissões no ambiente local Docker.
 *
 * Email:  teste.<role>@cachola.local  (pos_vendas → teste.posvendas@cachola.local)
 * Senha:  LocalTeste2026!
 * Units:  Pinheiros (default) + Moema (se existir)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// ─── Carregar .env.local manualmente (tsx não carrega automaticamente) ──────
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

// ─── GUARD-RAIL 1: Somente localhost ────────────────────────────────────────
if (
  !SUPABASE_URL?.includes('localhost') &&
  !SUPABASE_URL?.includes('127.0.0.1')
) {
  console.error(`\n❌ ABORT: NEXT_PUBLIC_SUPABASE_URL não é localhost (${SUPABASE_URL})`);
  console.error('   Este script SOMENTE roda contra Supabase local.');
  console.error('   Configure .env.local apontando para http://localhost:8000\n');
  process.exit(1);
}

// ─── GUARD-RAIL 2: Nunca em NODE_ENV=production ──────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('\n❌ ABORT: NODE_ENV=production detectado.');
  console.error('   Este script SOMENTE roda em ambiente de desenvolvimento.\n');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('❌ ABORT: SUPABASE_SERVICE_ROLE_KEY ausente em .env.local');
  process.exit(1);
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const DB_CONTAINER   = 'cacholaos-db';
const ADMIN_EMAIL    = 'admin@cachola.local';
const TEST_PASSWORD  = 'LocalTeste2026!';

const TEST_ROLES = [
  { role: 'diretor',     emailSlug: 'diretor'    },
  { role: 'gerente',     emailSlug: 'gerente'    },
  { role: 'vendedora',   emailSlug: 'vendedora'  },
  { role: 'pos_vendas',  emailSlug: 'posvendas'  },
  { role: 'decoracao',   emailSlug: 'decoracao'  },
  { role: 'manutencao',  emailSlug: 'manutencao' },
  { role: 'financeiro',  emailSlug: 'financeiro' },
  { role: 'rh',          emailSlug: 'rh'         },
  { role: 'freelancer',  emailSlug: 'freelancer' },
  { role: 'entregador',  emailSlug: 'entregador' },
] as const;

// ─── Supabase Admin client ───────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Helpers psql ────────────────────────────────────────────────────────────
function psql(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8' }
  );
}

function psqlJson(sql: string): unknown[] {
  const result = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -t -A -c "SELECT json_agg(t) FROM (${sql.replace(/"/g, '\\"')}) t"`,
    { encoding: 'utf-8' }
  ).trim();
  return result && result !== 'null' ? (JSON.parse(result) as unknown[]) : [];
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface UnitRow  { id: string; name: string }
interface UserRow  { id: string; email: string }

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   seed-local-test-users — AMBIENTE LOCAL APENAS      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`   Supabase: ${SUPABASE_URL}\n`);

  // 1. Listar todos os usuários auth.users e deletar exceto admin@cachola.local
  console.log('🗑️  Limpando usuários de teste anteriores...');
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const toDelete = listData.users.filter(u => u.email !== ADMIN_EMAIL);
  for (const u of toDelete) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
    if (delErr) {
      console.warn(`   ⚠️  Não foi possível deletar ${u.email}: ${delErr.message}`);
    } else {
      console.log(`   ✅ Deletado: ${u.email}`);
    }
  }
  console.log(`   ${toDelete.length} usuário(s) removido(s).`);

  // Limpar public.users órfãos (sem CASCADE automático no self-hosted local)
  psql(`DELETE FROM public.users WHERE email LIKE 'teste.%@cachola.local'`);
  console.log('   ✅ public.users órfãos removidos.\n');

  // 2. Descobrir unidades dinamicamente
  const units = psqlJson('SELECT id, name FROM public.units ORDER BY name') as UnitRow[];
  if (!units.length) {
    console.error('❌ Nenhuma unidade em public.units — importe o banco de produção primeiro.');
    process.exit(1);
  }

  const pinheiros = units.find(u => u.name.toLowerCase().includes('pinheiros'));
  const moema     = units.find(u => u.name.toLowerCase().includes('moema'));
  const defaultUnit = pinheiros ?? units[0];

  console.log('📍 Unidades encontradas:');
  units.forEach(u => console.log(`   - ${u.name} (${u.id})`));
  console.log(`   Default: ${defaultUnit.name}\n`);

  // 3. Criar os 10 usuários de teste
  const created: Array<{ email: string; role: string; userId: string }> = [];

  for (const { role, emailSlug } of TEST_ROLES) {
    const email = `teste.${emailSlug}@cachola.local`;
    const name  = `Teste ${role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}`;

    console.log(`👤 Criando: ${email} (${role})`);

    // 3a. auth.users via Admin API
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password:      TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    let userId: string;
    if (authErr) {
      // Caso já exista: buscar e atualizar senha
      if (
        authErr.message.toLowerCase().includes('already') ||
        authErr.message.toLowerCase().includes('exists') ||
        (authErr as { status?: number }).status === 422
      ) {
        const { data: refreshList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = refreshList?.users.find(u => u.email === email);
        if (!existing) throw new Error(`Usuário ${email} reportado como existente mas não encontrado`);
        userId = existing.id;
        await supabase.auth.admin.updateUserById(userId, { password: TEST_PASSWORD });
        console.log(`   ℹ️  Já existia — senha atualizada`);
      } else {
        throw authErr;
      }
    } else {
      userId = authData.user.id;
      console.log(`   ✅ auth.users: ${userId}`);
    }

    // 3b. public.users via psql
    psql(
      `INSERT INTO public.users (id, email, name, role, is_active) ` +
      `VALUES ('${userId}', '${email}', '${name.replace(/'/g, "''")}', '${role}', true) ` +
      `ON CONFLICT (id) DO UPDATE SET role = '${role}', is_active = true, name = '${name.replace(/'/g, "''")}'`
    );
    console.log(`   ✅ public.users: role=${role}`);

    // 3c. user_units: Pinheiros (default) + Moema (se disponível)
    psql(
      `INSERT INTO public.user_units (user_id, unit_id, role, is_default) ` +
      `VALUES ('${userId}', '${defaultUnit.id}', '${role}', true) ` +
      `ON CONFLICT (user_id, unit_id) DO UPDATE SET role = '${role}', is_default = true`
    );
    console.log(`   ✅ user_units: ${defaultUnit.name} (default)`);

    if (moema && moema.id !== defaultUnit.id) {
      psql(
        `INSERT INTO public.user_units (user_id, unit_id, role, is_default) ` +
        `VALUES ('${userId}', '${moema.id}', '${role}', false) ` +
        `ON CONFLICT (user_id, unit_id) DO UPDATE SET role = '${role}', is_default = false`
      );
      console.log(`   ✅ user_units: ${moema.name}`);
    }

    // 3d. user_permissions: fan-out de role_default_perms
    // ON CONFLICT usa o nome da constraint pois a chave inclui unit_id nullable (NULLS NOT DISTINCT)
    psql(
      `INSERT INTO public.user_permissions (user_id, module, action, granted) ` +
      `SELECT '${userId}', module, action, granted ` +
      `FROM public.role_default_perms ` +
      `WHERE role = '${role}' ` +
      `ON CONFLICT ON CONSTRAINT user_permissions_user_unit_module_action_key DO UPDATE SET granted = EXCLUDED.granted`
    );
    console.log(`   ✅ user_permissions: fan-out de role_default_perms`);

    created.push({ email, role, userId });
    console.log();
  }

  // 4. Validação final
  console.log('─────────────────────────────────────────────────────');
  console.log('📋 Validação final:\n');

  const rows = psqlJson(
    `SELECT u.email, u.role, ` +
    `(SELECT COUNT(*) FROM public.user_units WHERE user_id = u.id) AS units, ` +
    `(SELECT COUNT(*) FROM public.user_permissions WHERE user_id = u.id) AS perms ` +
    `FROM public.users u ` +
    `WHERE u.email LIKE 'teste.%@cachola.local' ` +
    `ORDER BY u.role`
  ) as Array<{ email: string; role: string; units: string; perms: string }>;

  console.table(rows.map(r => ({
    email: r.email,
    role:  r.role,
    units: Number(r.units),
    perms: Number(r.perms),
  })));

  console.log('\n🎉 Laboratório de teste pronto!');
  console.log('─────────────────────────────────────────────────────');
  console.log(`   Senha de todos: ${TEST_PASSWORD}`);
  console.log(`   URL:            http://localhost:3000/login`);
  console.log('─────────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('❌ Seed falhou:', err);
  process.exit(1);
});
