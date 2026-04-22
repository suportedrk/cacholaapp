/**
 * Open Graph Image dinâmica via Next.js App Router.
 * Serve em /opengraph-image.png — Next.js injeta <meta property="og:image"> automaticamente.
 * Fonte carregada via readFileSync (nunca fetch em runtime).
 */
import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Cachola OS — Sistema de Gestão do Buffet Infantil'

export default function OGImage() {
  const font = readFileSync(join(process.cwd(), 'public/fonts/PlayfairDisplay-Black.ttf'))

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#7C8D78',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '72px',
        }}
      >
        {/* Lettermark */}
        <div
          style={{
            width: '260px',
            height: '260px',
            background: 'rgba(227, 218, 209, 0.15)',
            border: '3px solid rgba(227, 218, 209, 0.4)',
            borderRadius: '55px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'PlayfairBlack',
              fontWeight: 900,
              fontSize: '213px',
              color: '#E3DAD1',
              lineHeight: 1,
              marginLeft: '8px',
              marginBottom: '5px',
            }}
          >
            C
          </span>
        </div>

        {/* Texto */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <span
            style={{
              fontFamily: 'PlayfairBlack',
              fontWeight: 900,
              fontSize: '96px',
              color: '#E3DAD1',
              lineHeight: 1,
              letterSpacing: '-2px',
            }}
          >
            Cachola OS
          </span>
          <span
            style={{
              fontSize: '32px',
              color: 'rgba(227, 218, 209, 0.75)',
              fontFamily: 'sans-serif',
              letterSpacing: '0.5px',
            }}
          >
            Sistema de Gestão do Buffet Infantil
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'PlayfairBlack', data: font, weight: 900, style: 'normal' }],
    },
  )
}
