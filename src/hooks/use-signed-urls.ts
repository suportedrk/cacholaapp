'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Batch-generates signed URLs for private Supabase Storage buckets.
 * Paths are storage paths (e.g. "maintenance-photos/order_id/photo.jpg"), NOT full URLs.
 * Signed URLs are valid for 1h; React Query staleTime of 30min avoids unnecessary re-fetches.
 */
export function useSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
) {
  return useQuery({
    queryKey: ['signed-urls', bucket, paths],
    queryFn: async () => {
      if (paths.length === 0) return {}
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, expiresIn)
      if (error) throw error
      const map: Record<string, string> = {}
      data?.forEach((item) => {
        if (item.signedUrl && item.path) map[item.path] = item.signedUrl
      })
      return map
    },
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000, // 30min — URLs valid for 1h
  })
}
