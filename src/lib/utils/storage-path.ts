/**
 * Normaliza um valor de `photo_url` de checklist para o PATH de storage.
 *
 * Após a migration 169 o bucket `checklist-photos` é PRIVADO e gravamos o path
 * (ex.: `userId/checklistId/itemId.jpg`). Linhas antigas podem ainda conter a
 * URL pública legada (`.../object/public/checklist-photos/<path>`) até o backfill
 * rodar. Este helper aceita os dois formatos e sempre devolve o `<path>`, para
 * que a exibição via signed URL funcione independentemente do estado do backfill.
 */
export function toChecklistPhotoPath(value: string): string {
  const marker = '/checklist-photos/'
  const idx = value.indexOf(marker)
  return idx >= 0 ? value.slice(idx + marker.length) : value
}
