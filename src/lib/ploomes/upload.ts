// ============================================================
// Ploomes CRM — Upload de Arquivos para Deals
// ============================================================
// Uso principal: enviar PDF de checklist finalizado de volta ao Deal.

import { ploomesUpload } from './client'
import type { PloomesAttachment } from './types'

type UploadResponse = {
  value?: PloomesAttachment[]
}

/**
 * Faz upload de um arquivo para um Deal no Ploomes.
 * Retorna o primeiro anexo criado (com Id, Name, Url).
 */
export async function uploadFileToDeal(
  dealId: string | number,
  file: File | Blob,
  filename?: string,
): Promise<PloomesAttachment> {
  const form = new FormData()
  const name = filename ?? (file instanceof File ? file.name : `anexo-${Date.now()}.pdf`)
  form.append('file', file, name)

  const response = await ploomesUpload<UploadResponse>(
    `Deals(${dealId})/UploadFile?$expand=Attachments`,
    form,
  )

  const attachment = response.value?.[0]
  if (!attachment) {
    throw new Error(`Upload para Deal ${dealId} não retornou anexo.`)
  }

  console.info(`[Ploomes upload] Arquivo "${name}" enviado para Deal ${dealId} → Attachment ${attachment.Id}`)
  return attachment
}
