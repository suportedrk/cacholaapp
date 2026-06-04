/**
 * Testes unitários da função pura `resolveEffectiveUnitId`.
 *
 * Cobre a hierarquia canônica Order > Deal usada por sync.ts (unidade do
 * evento) e sync-orders.ts (unidade dos produtos vendidos). Garante que a
 * correção do bug de divergência de unidade é idempotente: sem unidade
 * escolhida no Order, o resultado é idêntico ao comportamento histórico
 * (cai no Deal).
 *
 * Executar:
 *   npx tsx --test src/lib/ploomes/resolve-unit.test.ts
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveEffectiveUnitId } from './resolve-unit'

const MOEMA = 'df2e4286-4615-420f-b311-fd8289596511'
const PINHEIROS = '36d3b2e5-42fd-4094-a726-258c0a643986'

test('(a) Order com chosen_unit_id preenchido → vence o Deal', () => {
  // Caso MATTEO: Order escolhida = Moema, Deal = Pinheiros → Moema.
  assert.equal(resolveEffectiveUnitId(MOEMA, PINHEIROS), MOEMA)
})

test('(b) Order sem chosen_unit_id (null) → cai no Deal (idempotente)', () => {
  assert.equal(resolveEffectiveUnitId(null, PINHEIROS), PINHEIROS)
})

test('(b) Order sem chosen_unit_id (undefined) → cai no Deal (idempotente)', () => {
  assert.equal(resolveEffectiveUnitId(undefined, PINHEIROS), PINHEIROS)
})

test('(c) ambos ausentes → null (comportamento seguro definido)', () => {
  assert.equal(resolveEffectiveUnitId(null, null), null)
  assert.equal(resolveEffectiveUnitId(undefined, null), null)
})

test('chosen e deal iguais → retorna a mesma unidade (sem efeito colateral)', () => {
  assert.equal(resolveEffectiveUnitId(MOEMA, MOEMA), MOEMA)
})
