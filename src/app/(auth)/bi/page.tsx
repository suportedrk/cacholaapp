import { BarChart3 } from 'lucide-react'

export default function BIPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
        <BarChart3 className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">
        Business Intelligence
      </h1>
      <p className="text-text-secondary max-w-md">
        O módulo de BI está em desenvolvimento. Em breve você terá acesso a
        taxa de conversão, análise de manutenções, funil de vendas e muito mais.
      </p>
    </div>
  )
}
