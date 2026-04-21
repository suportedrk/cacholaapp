/**
 * Seed de usuário admin local — idempotente.
 * Uso: npm run seed:local-admin
 *
 * NUNCA executa contra produção. Aborta se URL não for localhost.
 *
 * Estratégia híbrida:
 *  - auth.users → via Supabase Admin API (service_role)
 *  - public.users + public.user_units → via psql no container Docker
 *    (service_role via PostgREST não tem permissão de schema em self-hosted local)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// Carregar .env.local manualmente (tsx não carrega automaticamente)
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// GUARD-RAIL: nunca rodar contra produção
if (!SUPABASE_URL?.startsWith('http://localhost')) {
  console.error(`❌ ABORT: NEXT_PUBLIC_SUPABASE_URL não é localhost (${SUPABASE_URL})`);
  console.error('   Este script SOMENTE roda contra Supabase local.');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('❌ ABORT: SUPABASE_SERVICE_ROLE_KEY ausente em .env.local');
  process.exit(1);
}

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@cachola.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'LocalAdmin2026!';
const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     ?? 'Admin Local';
const DB_CONTAINER   = process.env.SEED_DB_CONTAINER   ?? 'cacholaos-db';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

async function main() {
  console.log(`🌱 Seed admin local em ${SUPABASE_URL}`);
  console.log(`   Email: ${ADMIN_EMAIL}\n`);

  // 1. Criar ou reusar usuário em auth.users via Admin API
  let userId: string;

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  });

  if (createErr) {
    const alreadyExists =
      createErr.message.toLowerCase().includes('already') ||
      createErr.message.toLowerCase().includes('exists') ||
      (createErr as { status?: number }).status === 422;

    if (alreadyExists) {
      console.log('   ℹ️  Usuário já existe em auth.users — buscando ID...');
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = list.users.find(u => u.email === ADMIN_EMAIL);
      if (!existing) throw new Error('Usuário reportado como existente mas não encontrado em listUsers');
      userId = existing.id;
      await supabase.auth.admin.updateUserById(userId, { password: ADMIN_PASSWORD });
      console.log(`   ✅ Senha atualizada`);
    } else {
      throw createErr;
    }
  } else {
    userId = created.user.id;
    console.log(`   ✅ auth.users: ${userId}`);
  }

  // 2. Upsert em public.users via psql (service_role PostgREST não tem permissão de schema)
  psql(
    `INSERT INTO public.users (id, email, name, role, is_active) ` +
    `VALUES ('${userId}', '${ADMIN_EMAIL}', '${ADMIN_NAME}', 'super_admin', true) ` +
    `ON CONFLICT (id) DO UPDATE SET role = 'super_admin', is_active = true, name = '${ADMIN_NAME}'`
  );
  console.log('   ✅ public.users: role=super_admin');

  // 3. Buscar unidades via psql (PostgREST service_role tem restrições no self-hosted local)
  const units = psqlJson('SELECT id, name FROM public.units ORDER BY name') as { id: string; name: string }[];

  if (!units.length) {
    console.warn('   ⚠️  Nenhuma unidade em public.units — banco local sem seeds.');
    console.warn('      super_admin enxerga tudo via is_global_viewer(), deve funcionar.');
  } else {
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      psql(
        `INSERT INTO public.user_units (user_id, unit_id, role, is_default) ` +
        `VALUES ('${userId}', '${unit.id}', 'super_admin', ${i === 0}) ` +
        `ON CONFLICT (user_id, unit_id) DO UPDATE SET role = 'super_admin'`
      );
      console.log(`   ✅ Associado: ${unit.name}${i === 0 ? ' (default)' : ''}`);
    }
  }

  console.log('\n🎉 Seed concluído!');
  console.log('─────────────────────────────');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Senha: ${ADMIN_PASSWORD}`);
  console.log(`   URL:   http://localhost:3000`);
  console.log('─────────────────────────────');
}

main().catch(err => {
  console.error('❌ Seed falhou:', err);
  process.exit(1);
});
