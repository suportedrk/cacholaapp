'use client'

interface Props {
  open:      boolean
  onKeep:    () => void
  onDiscard: () => void
}

export function DiscardChangesDialog({ open, onKeep, onDiscard }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onKeep}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-card border border-border p-6 shadow-lg">
        <h2 className="text-base font-semibold text-foreground">
          Descartar alterações?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          As alterações feitas não foram salvas e serão perdidas.
        </p>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onKeep}
            className="h-10 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Continuar editando
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="h-10 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  )
}
