export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
export const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? ''

export function getVersionTooltip(): string {
  const parts = [`v${APP_VERSION}`, `commit ${BUILD_COMMIT}`]
  if (BUILD_DATE) parts.push(`build ${BUILD_DATE}`)
  return parts.join(' · ')
}
