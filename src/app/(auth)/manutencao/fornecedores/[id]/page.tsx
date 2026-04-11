import { redirect } from 'next/navigation'

/** Rota legada — fornecedores foram migrados para /prestadores */
export default function FornecedorDetalhePage() {
  redirect('/prestadores')
}
