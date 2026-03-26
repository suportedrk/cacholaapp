// Layout para rotas públicas (login, recuperar senha)
// Sem navbar/sidebar — tela cheia centrada
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-secondary/30">
      {children}
    </div>
  )
}
