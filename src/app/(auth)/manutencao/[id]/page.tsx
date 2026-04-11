import { redirect } from 'next/navigation'

/** Rota legada — o módulo foi migrado para /manutencao/chamados */
export default function OrdemDetalhePage() {
  redirect('/manutencao/chamados')
}
