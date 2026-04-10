import { redirect } from 'next/navigation'

/**
 * /manutencao redireciona para /manutencao/chamados.
 * A rota principal agora é um subitem da sidebar.
 */
export default function ManutencaoRootPage() {
  redirect('/manutencao/chamados')
}
