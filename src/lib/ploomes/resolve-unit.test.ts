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
 *   npm test            (vitest run — descobre todos os *.test.ts)
 *   npm run test:watch  (modo watch)
 */

import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolveEffectiveUnitId, resolveFestaUnit } from './resolve-unit'

const MOEMA = 'df2e4286-4615-420f-b311-fd8289596511'
const PINHEIROS = '36d3b2e5-42fd-4094-a726-258c0a643986'
const ESCOLHIDA = 'aaaaaaaa-0000-0000-0000-000000000001'

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

// ── resolveFestaUnit (3 níveis: chosen > Escolhida > Pretendida) ──────────
// Paridade exata com SQL public.resolve_festa_unit = COALESCE(chosen, escolhida, pretendida).

test('festa: só chosen presente → vence todos', () => {
  assert.equal(resolveFestaUnit(MOEMA, ESCOLHIDA, PINHEIROS), MOEMA)
})

test('festa: sem chosen → cai na Escolhida', () => {
  assert.equal(resolveFestaUnit(null, ESCOLHIDA, PINHEIROS), ESCOLHIDA)
  assert.equal(resolveFestaUnit(undefined, ESCOLHIDA, PINHEIROS), ESCOLHIDA)
})

test('festa: sem chosen e sem Escolhida → cai na Pretendida (nunca primeira-ativa)', () => {
  assert.equal(resolveFestaUnit(null, null, PINHEIROS), PINHEIROS)
  assert.equal(resolveFestaUnit(undefined, undefined, PINHEIROS), PINHEIROS)
})

test('festa: todos ausentes → null (comportamento seguro)', () => {
  assert.equal(resolveFestaUnit(null, null, null), null)
  assert.equal(resolveFestaUnit(undefined, undefined, null), null)
})

test('festa: paridade COALESCE — primeiro não-nulo na ordem chosen,escolhida,pretendida', () => {
  // espelha COALESCE: chosen ?? escolhida ?? pretendida
  assert.equal(resolveFestaUnit(null, ESCOLHIDA, PINHEIROS), ESCOLHIDA)
  assert.equal(resolveFestaUnit(MOEMA, null, PINHEIROS), MOEMA)
})
