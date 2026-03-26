import { redirect } from 'next/navigation'

// Redirecionar raiz → middleware decide para onde vai
// (login se não autenticado, dashboard se autenticado)
export default function RootPage() {
  redirect('/dashboard')
}
