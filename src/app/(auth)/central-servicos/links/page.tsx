import { LinksClient } from '../_components/links-client'

export const metadata = {
  title: 'Links úteis — Central de Serviços',
}

/**
 * /central-servicos/links — Links úteis (Bloco B).
 * O acesso é gateado pelo layout pai (/central-servicos/layout.tsx →
 * requirePermissionServer('central_servicos', 'view')). A camada de escrita
 * é controlada por check_permission na API e na RLS.
 */
export default function CentralServicosLinksPage() {
  return <LinksClient />
}
