/**
 * Favicon dinâmico via Next.js App Router.
 * Serve em /icon.png — Next.js injeta <link rel="icon"> automaticamente.
 * Fonte carregada via readFileSync (nunca fetch em runtime).
 */
import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  const font = readFileSync(join(process.cwd(), 'public/fonts/PlayfairDisplay-Black.ttf'))

  return new ImageResponse(
    (
      <div
        style={{
          width: '192px',
          height: '192px',
          background: '#7C8D78',
          borderRadius: '41px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'PlayfairBlack',
            fontWeight: 900,
            fontSize: '158px',
            color: '#E3DAD1',
            lineHeight: 1,
            marginLeft: '6px',
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
