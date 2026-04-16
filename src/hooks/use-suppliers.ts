'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { MaintenanceSupplier, SupplierContact, SupplierDocument } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type SupplierFilters = {
  search?:   string
  category?: string
  isActive?: boolean
}

export type SupplierWithCounts = MaintenanceSupplier & {
  contacts:        SupplierContact[]
  documents_count: [{ count: number }] | null
}

export type SupplierWithDetails = MaintenanceSupplier & {
  contacts:  SupplierContact[]
  documents: SupplierDocument[]
}

export type SupplierInsert = Omit<MaintenanceSupplier, 'id' | 'created_at' | 'updated_at' | 'unit_id'>
export type ContactInsert  = Omit<SupplierContact,    'id' | 'created_at'>

export const SUPPLIER_CATEGORIES = [
  'Refrigeração', 'Elétrica', 'Hidráulica', 'Pintura',
  'Serralheria', 'Jardinagem', 'Limpeza', 'Geral', 'Outra',
] as const

export type SupplierCategory = typeof SUPPLIER_CATEGORIES[number]

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────
export function useSuppliers(filters: SupplierFilters = {}) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)
  const { search, category, isActive } = filters

  return useQuery({
    queryKey: ['suppliers', activeUnitId, filters],
    enabled:  isSessionReady,
    staleTime: 30 * 1000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_suppliers')
        .select('*, contacts:supplier_contacts(*), documents_count:supplier_documents(count)')
        .order('company_name', { ascending: true })
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      if (search?.trim()) {
        q = q.or(`company_name.ilike.%${search}%,trade_name.ilike.%${search}%`)
      }
      if (category) q = q.eq('category', category)
      if (isActive !== undefined) q = q.eq('is_active', isActive)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as SupplierWithCounts[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────────────────────
export function useSupplier(id: string | null) {
  const { activeUnitId: _activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['supplier', id],
    enabled:  !!id && isSessionReady,
    staleTime: 30 * 1000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_suppliers')
        .select('*, contacts:supplier_contacts(*), documents:supplier_documents(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as unknown as SupplierWithDetails
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CRUD — Supplier
// ─────────────────────────────────────────────────────────────
export function useCreateSupplier() {
  const qc             = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (data: SupplierInsert) => {
      const supabase = createClient()
      const { data: created, error } = await supabase
        .from('maintenance_suppliers')
        .insert({ ...data, unit_id: activeUnitId! } as any)
        .select('id')
        .single()
      if (error) throw error
      return created as { id: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', activeUnitId] })
      toast.success('Fornecedor cadastrado com sucesso!')
    },
    onError: () => toast.error('Erro ao cadastrar fornecedor.'),
  })
}

export function useUpdateSupplier() {
  const qc             = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SupplierInsert> }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_suppliers')
        .update(data as any)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['suppliers', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['supplier', id] })
      toast.success('Fornecedor atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar fornecedor.'),
  })
}

export function useDeleteSupplier() {
  const qc             = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_suppliers')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', activeUnitId] })
      toast.success('Fornecedor removido.')
    },
    onError: () => toast.error('Erro ao remover fornecedor.'),
  })
}

// ─────────────────────────────────────────────────────────────
// CRUD — Contacts
// ─────────────────────────────────────────────────────────────
export function useCreateContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: ContactInsert) => {
      const supabase = createClient()
      // Demote all other contacts to non-primary first
      if (data.is_primary) {
        await supabase
          .from('supplier_contacts')
          .update({ is_primary: false } as any)
          .eq('supplier_id', data.supplier_id)
      }
      const { error } = await supabase
        .from('supplier_contacts')
        .insert(data as any)
      if (error) throw error
    },
    onSuccess: (_, { supplier_id }) => {
      qc.invalidateQueries({ queryKey: ['supplier', supplier_id] })
      toast.success('Contato adicionado.')
    },
    onError: () => toast.error('Erro ao adicionar contato.'),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      supplierId,
      data,
    }: { id: string; supplierId: string; data: Partial<ContactInsert> }) => {
      const supabase = createClient()
      if (data.is_primary) {
        await supabase
          .from('supplier_contacts')
          .update({ is_primary: false } as any)
          .eq('supplier_id', supplierId)
          .neq('id', id)
      }
      const { error } = await supabase
        .from('supplier_contacts')
        .update(data as any)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { supplierId }) => {
      qc.invalidateQueries({ queryKey: ['supplier', supplierId] })
      toast.success('Contato atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar contato.'),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, supplierId }: { id: string; supplierId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('supplier_contacts')
        .delete()
        .eq('id', id)
      if (error) throw error
      return supplierId
    },
    onSuccess: (supplierId) => {
      qc.invalidateQueries({ queryKey: ['supplier', supplierId] })
      toast.success('Contato removido.')
    },
    onError: () => toast.error('Erro ao remover contato.'),
  })
}

// ─────────────────────────────────────────────────────────────
// CRUD — Documents
// ─────────────────────────────────────────────────────────────
export function useUploadSupplierDocument() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      supplierId,
      file,
      documentName,
      expiresAt,
      onProgress,
    }: {
      supplierId:   string
      file:         File
      documentName: string
      expiresAt?:   string
      onProgress?:  (pct: number) => void
    }) => {
      const supabase = createClient()

      // Sanitise filename and build path
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${supplierId}/${Date.now()}_${safeFilename}`

      // Simulate progress (Supabase JS v2 doesn't expose upload progress natively)
      let fakePct = 0
      const tick = setInterval(() => {
        fakePct = Math.min(fakePct + 12, 85)
        onProgress?.(fakePct)
      }, 180)

      const { error: storageError } = await supabase.storage
        .from('supplier-documents')
        .upload(path, file, { upsert: false })

      clearInterval(tick)
      if (storageError) throw storageError
      onProgress?.(100)

      // Insert DB record
      const { error: dbError } = await supabase
        .from('supplier_documents')
        .insert({
          supplier_id:     supplierId,
          name:            documentName,
          file_url:        path,
          file_type:       file.type || null,
          file_size_bytes: file.size || null,
          expires_at:      expiresAt || null,
        } as any)
      if (dbError) throw dbError

      return path
    },
    onSuccess: (_, { supplierId }) => {
      qc.invalidateQueries({ queryKey: ['supplier', supplierId] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Documento enviado.')
    },
    onError: () => toast.error('Erro ao enviar documento.'),
  })
}

export function useDeleteSupplierDocument() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      docId,
      supplierId,
      filePath,
    }: { docId: string; supplierId: string; filePath: string }) => {
      const supabase = createClient()
      // Best-effort storage removal (don't block on storage errors)
      await supabase.storage.from('supplier-documents').remove([filePath]).catch(() => null)
      const { error } = await supabase
        .from('supplier_documents')
        .delete()
        .eq('id', docId)
      if (error) throw error
      return supplierId
    },
    onSuccess: (supplierId) => {
      qc.invalidateQueries({ queryKey: ['supplier', supplierId] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Documento removido.')
    },
    onError: () => toast.error('Erro ao remover documento.'),
  })
}
