import { AvisosClient } from '../_components/avisos-client'

export const metadata = {
  title: 'Mural de Avisos — Central de Serviços',
}

/**
 * /central-servicos/avisos — Mural de Avisos (Bloco D).
 * Acesso gateado pelo layout pai (requirePermissionServer('central_servicos','view')).
 * A vigência (futuros/expirados ocultos para quem só lê) é garantida pela RLS.
 */
export default function CentralServicosAvisosPage() {
  return <AvisosClient />
}
