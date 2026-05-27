/**
 * Testes unitários da função pura `evaluatePermission`.
 *
 * Os wrappers `requirePermissionServer` / `requirePermissionApi` são thin
 * adapters que chamam `evaluatePermission` + redirect/NextResponse — cobertos
 * por inspeção de tipo + smoke do helper plpgsql `check_permission_or_raise`.
 *
 * Executar:
 *   npm test
 *   ou: npx tsx --test src/lib/auth/require-permission.test.ts
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePermission } from './require-permission'

type RpcResult = { data: boolean | null; error: { message: string } | null }

type SupabaseStub = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  rpc: (name: string, params: Record<string, unknown>) => Promise<RpcResult>
}

function makeStub(opts: {
  user?: { id: string } | null
  rpcResult?: RpcResult
  onRpc?: (name: string, params: Record<string, unknown>) => void
}): SupabaseStub {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user ?? null } }),
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      opts.onRpc?.(name, params)
      return opts.rpcResult ?? { data: false, error: null }
    },
  }
}

test('evaluatePermission: sem sessão → no-session (não chama RPC)', async () => {
  let rpcCalled = false
  const stub = makeStub({
    user: null,
    onRpc: () => { rpcCalled = true },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await evaluatePermission(stub as any, 'eventos', 'view')
  assert.deepEqual(result, { kind: 'no-session' })
  assert.equal(rpcCalled, false, 'não deve chamar RPC sem sessão')
})

test('evaluatePermission: rpc retorna true → ok', async () => {
  const stub = makeStub({
    user: { id: 'u1' },
    rpcResult: { data: true, error: null },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await evaluatePermission(stub as any, 'eventos', 'view')
  assert.deepEqual(result, { kind: 'ok' })
})

test('evaluatePermission: rpc retorna false → denied', async () => {
  const stub = makeStub({
    user: { id: 'u1' },
    rpcResult: { data: false, error: null },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await evaluatePermission(stub as any, 'eventos', 'view')
  assert.deepEqual(result, { kind: 'denied' })
})

test('evaluatePermission: rpc retorna null → denied (defensivo)', async () => {
  const stub = makeStub({
    user: { id: 'u1' },
    rpcResult: { data: null, error: null },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await evaluatePermission(stub as any, 'eventos', 'view')
  assert.deepEqual(result, { kind: 'denied' })
})

test('evaluatePermission: rpc retorna error → denied', async () => {
  const stub = makeStub({
    user: { id: 'u1' },
    rpcResult: { data: null, error: { message: 'boom' } },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await evaluatePermission(stub as any, 'eventos', 'view')
  assert.deepEqual(result, { kind: 'denied' })
})

test('evaluatePermission: passa nome e parâmetros corretos para check_permission', async () => {
  let captured: { name: string; params: Record<string, unknown> } | null = null
  const stub = makeStub({
    user: { id: 'user-123' },
    rpcResult: { data: true, error: null },
    onRpc: (name, params) => { captured = { name, params } },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await evaluatePermission(stub as any, 'manutencao', 'edit')
  assert.deepEqual(captured, {
    name: 'check_permission',
    params: { p_user_id: 'user-123', p_module: 'manutencao', p_action: 'edit' },
  })
})

test('evaluatePermission: módulos PT-BR (sanity check de tipo)', async () => {
  // Garante que os codes do catálogo PT-BR são aceitos pela tipagem.
  const stub = makeStub({
    user: { id: 'u1' },
    rpcResult: { data: true, error: null },
  })
  const modulos = ['vendas', 'bi', 'checklist_comercial', 'notificacoes', 'logs'] as const
  for (const m of modulos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await evaluatePermission(stub as any, m, 'view')
    assert.deepEqual(result, { kind: 'ok' }, `módulo "${m}" deveria passar`)
  }
})
