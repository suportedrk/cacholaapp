'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { UploadDocumentInput } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// useUploadProviderDocument
// ─────────────────────────────────────────────────────────────
export function useUploadProviderDocument() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      provider_id,
      unit_id,
      file,
      name,
      doc_type,
      expires_at,
      onProgress,
    }: UploadDocumentInput) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Sanitise filename and build storage path
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${unit_id}/${provider_id}/${Date.now()}_${safeFilename}`

      // Simulated progress (Supabase JS v2 has no upload progress events)
      let fakePct = 0
      const tick = setInterval(() => {
        fakePct = Math.min(fakePct + 12, 85)
        onProgress?.(fakePct)
      }, 180)

      const { error: storageError } = await supabase.storage
        .from('provider-documents')
        .upload(path, file, { upsert: false })

      clearInterval(tick)
      if (storageError) throw storageError
      onProgress?.(100)

      // Insert DB record
      const { data, error: dbError } = await supabase
        .from('provider_documents')
        .insert({
          provider_id,
          unit_id,
          name,
          doc_type,
          file_url:    path,
          file_name:   file.name,
          file_size:   file.size ?? null,
          mime_type:   file.type || null,
          expires_at:  expires_at ?? null,
          uploaded_by: user?.id ?? null,
        })
        .select()
        .single()
      if (dbError) throw dbError
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      toast.success('Documento enviado com sucesso.')
    },
    onError: () => toast.error('Erro ao enviar documento.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useDeleteProviderDocument
// ─────────────────────────────────────────────────────────────
export function useDeleteProviderDocument() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      id,
      provider_id,
      file_url,
    }: { id: string; provider_id: string; file_url: string }) => {
      const supabase = createClient()

      // Best-effort storage removal — don't block on storage errors
      await supabase.storage
        .from('provider-documents')
        .remove([file_url])
        .catch(() => null)

      const { error } = await supabase
        .from('provider_documents')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { id, provider_id }
    },
    onSuccess: ({ provider_id }) => {
      qc.invalidateQueries({ queryKey: ['provider', provider_id, activeUnitId] })
      toast.success('Documento removido.')
    },
    onError: () => toast.error('Erro ao remover documento.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useProviderDocumentUrl — Signed URL para download/visualização
// ─────────────────────────────────────────────────────────────
export function useProviderDocumentUrl(
  filePath: string | null,
  expiresIn = 3600
) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider-doc-url', filePath],
    enabled: !!filePath && isSessionReady,
    staleTime: 30 * 60 * 1000, // 30 min (URL válida por 1h)
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('provider-documents')
        .createSignedUrl(filePath!, expiresIn)
      if (error) return null
      return data?.signedUrl ?? null
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useProviderDocumentUrls — Batch signed URLs
// ─────────────────────────────────────────────────────────────
export function useProviderDocumentUrls(
  filePaths: string[],
  expiresIn = 3600
) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider-doc-urls', filePaths],
    enabled: filePaths.length > 0 && isSessionReady,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Record<string, string>> => {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('provider-documents')
        .createSignedUrls(filePaths, expiresIn)
      if (error) throw error
      const map: Record<string, string> = {}
      data?.forEach((item) => {
        if (item.signedUrl && item.path) map[item.path] = item.signedUrl
      })
      return map
    },
  })
}
