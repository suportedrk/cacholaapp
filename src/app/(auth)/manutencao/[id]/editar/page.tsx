import { redirect } from 'next/navigation'

/** Rota legada — o módulo foi migrado para /manutencao/chamados */
export default function EditarOrdemPage() {
  redirect('/manutencao/chamados')
}
