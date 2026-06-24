import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants'

/**
 * O módulo Central de Serviços NÃO tem tela inicial (hub): o item do menu
 * lateral apenas expande os filhos (Links / Contatos / Avisos). Acesso direto a
 * `/central-servicos` (URL ou breadcrumb) é encaminhado para a primeira
 * sub-página, em vez de exibir uma landing própria.
 */
export default function CentralServicosPage() {
  redirect(ROUTES.centralServicosAvisos)
}
