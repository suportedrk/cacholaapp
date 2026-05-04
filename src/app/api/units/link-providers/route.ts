// POST /api/units/link-providers
// Copia prestadores de uma unidade origem para a unidade destino.
// Cada ServiceProvider tem unit_id próprio → cria uma CÓPIA com o novo unit_id.
// Copia também: provider_contacts, provider_services (com category_id ajustado).
// Loga cada provider duplicado para rastreabilidade.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { ContactType, PriceType } from '@/types/providers'
import { hasRole, ADMIN_UNITS_MANAGE_ROLES } from '@/config/roles'

interface LinkProvidersPayload {
  sourceUnitId: string
  targetUnitId: string
  providerIds: string[]  // IDs dos providers na unidade origem
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !hasRole(profile.role, ADMIN_UNITS_MANAGE_ROLES)) {
      return NextResponse.json({ error: 'Acesso restrito a super_admin e diretor.' }, { status: 403 })
    }

    const body: LinkProvidersPayload = await req.json()
    const { sourceUnitId, targetUnitId, providerIds } = body

    if (!sourceUnitId || !targetUnitId || !Array.isArray(providerIds) || providerIds.length === 0) {
      return NextResponse.json({ error: 'sourceUnitId, targetUnitId e providerIds são obrigatórios.' }, { status: 400 })
    }
    if (sourceUnitId === targetUnitId) {
      return NextResponse.json({ error: 'Origem e destino não podem ser a mesma unidade.' }, { status: 400 })
    }

    // Mapeamento de categorias: slug na origem → id na categoria de mesmo slug no destino
    const { data: targetCats } = await supabase
      .from('service_categories')
      .select('id, slug')
      .eq('unit_id', targetUnitId)
    const catSlugToId = Object.fromEntries((targetCats ?? []).map((c) => [c.slug, c.id]))

    // Categorias da origem para mapear slug
    const { data: sourceCats } = await supabase
      .from('service_categories')
      .select('id, slug')
      .eq('unit_id', sourceUnitId)
    const catIdToSlug = Object.fromEntries((sourceCats ?? []).map((c) => [c.id, c.slug]))

    const copied: string[] = []
    const skipped: string[] = []
    const errors: string[] = []

    for (const providerId of providerIds) {
      try {
        // Buscar provider com contatos e serviços
        const { data: src } = await supabase
          .from('service_providers')
          .select('*, provider_contacts(*), provider_services(*)')
          .eq('id', providerId)
          .eq('unit_id', sourceUnitId)
          .single()

        if (!src) { skipped.push(providerId); continue }

        // Verificar se já existe cópia (mesmo document_number na unidade destino)
        const { data: existing } = await supabase
          .from('service_providers')
          .select('id')
          .eq('unit_id', targetUnitId)
          .eq('document_number', src.document_number)
          .maybeSingle()

        if (existing) {
          console.info(`[link-providers] Pulado (já existe): ${src.name} (${src.document_number}) → unidade ${targetUnitId}`)
          skipped.push(providerId)
          continue
        }

        // Criar cópia do provider
        const { data: newProvider } = await supabase
          .from('service_providers')
          .insert({
            unit_id: targetUnitId,
            document_type: src.document_type,
            document_number: src.document_number,
            name: src.name,
            legal_name: src.legal_name,
            status: src.status,
            tags: src.tags,
            notes: src.notes,
            address: src.address,
            city: src.city,
            state: src.state,
            zip_code: src.zip_code,
            website: src.website,
            instagram: src.instagram,
            created_by: user.id,
          })
          .select('id')
          .single()

        if (!newProvider?.id) { errors.push(providerId); continue }

        // Copiar contatos
        const contacts = (src.provider_contacts ?? []) as unknown as Array<{
          type: string; value: string; label: string | null; is_primary: boolean
        }>
        if (contacts.length > 0) {
          await supabase.from('provider_contacts').insert(
            contacts.map((c) => ({
              provider_id: newProvider.id,
              unit_id: targetUnitId,
              type: c.type as ContactType,
              value: c.value,
              label: c.label,
              is_primary: c.is_primary,
            }))
          )
        }

        // Copiar serviços — mapear category_id via slug
        const services = (src.provider_services ?? []) as unknown as Array<{
          category_id: string; description: string | null; price_type: string;
          price_value: number | null; currency: string; notes: string | null; is_active: boolean
        }>
        for (const svc of services) {
          const slug = catIdToSlug[svc.category_id]
          const targetCatId = slug ? catSlugToId[slug] : null

          await supabase.from('provider_services').insert({
            provider_id: newProvider.id,
            unit_id: targetUnitId,
            category_id: targetCatId ?? svc.category_id, // fallback: ID original
            description: svc.description,
            price_type: svc.price_type as PriceType,
            price_value: svc.price_value,
            currency: svc.currency,
            notes: svc.notes,
            is_active: svc.is_active,
          })
        }

        console.info(`[link-providers] Copiado: ${src.name} (${src.document_number}) → unidade ${targetUnitId} (novo ID: ${newProvider.id})`)
        copied.push(providerId)
      } catch (provErr) {
        console.error(`[link-providers] Erro ao copiar provider ${providerId}:`, provErr)
        errors.push(providerId)
      }
    }

    return NextResponse.json({ ok: true, copied: copied.length, skipped: skipped.length, errors: errors.length })
  } catch (err) {
    console.error('[POST /api/units/link-providers]', err)
    return NextResponse.json({ error: 'Erro interno ao vincular prestadores.' }, { status: 500 })
  }
}
