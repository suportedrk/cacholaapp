import { ContatosClient } from '../_components/contatos-client'

export const metadata = {
  title: 'Agenda de Contatos — Central de Serviços',
}

/**
 * /central-servicos/contatos — Agenda de Contatos (Bloco C1).
 * Acesso gateado pelo layout pai (requirePermissionServer('central_servicos','view')).
 * Inativos são escondidos pela própria RLS para quem só tem view.
 */
export default function CentralServicosContatosPage() {
  return <ContatosClient />
}
