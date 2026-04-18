'use client'

import { Star, Lightbulb } from 'lucide-react'

export function CarteiraLivreRecompraBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm">
      <Star className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1.5">
        <p className="font-medium text-amber-800 dark:text-amber-300">Carteira Livre — Recompra</p>
        <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
          Contatos de vendedoras inativas ou sem responsável definido. Qualquer vendedora pode
          registrar o contato — quem registrar captura a oportunidade.
        </p>
        <div className="flex items-start gap-1.5 pt-0.5">
          <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
            <span className="font-medium">Dica:</span> a maioria das oportunidades aqui são de
            clientes que fecharam com vendedoras que não estão mais na equipe. Ligue agora —
            esses clientes podem estar esquecidos.
          </p>
        </div>
      </div>
    </div>
  )
}
