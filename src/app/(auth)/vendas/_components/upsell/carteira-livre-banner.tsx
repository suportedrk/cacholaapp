'use client'

import { Star, Info } from 'lucide-react'

export function CarteireLivreBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm">
      <Star className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1">
        <p className="font-medium text-amber-800 dark:text-amber-300">Carteira Livre</p>
        <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
          Contatos de vendedoras inativas ou sem responsável definido. Qualquer vendedora pode
          registrar o contato — quem registrar captura a oportunidade.
        </p>
      </div>
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-500 dark:text-amber-500 ml-auto" />
    </div>
  )
}
