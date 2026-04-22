/**
 * Apple Touch Icon dinâmico via Next.js App Router.
 * Serve em /apple-icon.png — Next.js injeta <link rel="apple-touch-icon"> automaticamente.
 * Fonte carregada via readFileSync (nunca fetch em runtime).
 */
import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const font = readFileSync(join(process.cwd(), 'public/fonts/PlayfairDisplay-Black.ttf'))

  return new ImageResponse(
    (
      <div
        style={{
          width: '180px',
          height: '180px',
          background: '#7C8D78',
          borderRadius: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'PlayfairBlack',
            fontWeight: 900,
            fontSize: '148px',
            color: '#E3DAD1',
            lineHeight: 1,
            marginLeft: '5px',
            marginBottom: '4px',
          }}
        >
          C
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'PlayfairBlack', data: font, weight: 900, style: 'normal' }],
    },
  )
}
