import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard para /relatorios — módulo relatorios (catálogo próprio, NÃO 'bi').
 * Governado por permissão configurável: check_permission(uid, 'relatorios', 'view').
 * O toggle em /admin/cargos passa a controlar o acesso à rota (Fase 3, Parte 2).
 * Backfill de relatorios.view aplicado na migration 126; overrides de diretor
 * (carol/vinicius, view+export) honrados e intocados.
 * Acesso: super_admin (bypass) + diretor. As 13 RPCs report_* são SECURITY INVOKER
 * (RLS) e não têm guard interno — não foram convertidas.
 */
export default async function RelatoriosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('relatorios', 'view')
  return <>{children}</>
}
