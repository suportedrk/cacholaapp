/**
 * Gera os ícones estáticos do PWA usando satori + sharp.
 * Uso: npx tsx scripts/generate-icons.ts
 *
 * Saídas:
 *   public/icons/icon-192.png  (PWA manifest)
 *   public/icons/icon-512.png  (PWA manifest + splash)
 *
 * Parâmetros visuais aprovados (base 512px):
 *   fontSize: 420px · marginLeft: 15px · marginBottom: 10px · borderRadius: 108px
 *   bg: #7C8D78 (verde-sálvia) · fg: #E3DAD1 (bege)
 */
import satori from 'satori'
import type { ReactNode } from 'react'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const fontData = readFileSync(resolve(ROOT, 'public/fonts/PlayfairDisplay-Black.ttf'))

const BASE = 512

/** Escala um valor da base 512 para o tamanho alvo. */
const sc = (v: number, size: number) => Math.round((v * size) / BASE)

async function makeIcon(size: number): Promise<Buffer> {
  const svg = await satori(
    ({
      type: 'div',
      props: {
        style: {
          width: `${size}px`,
          height: `${size}px`,
          background: '#7C8D78',
          borderRadius: `${sc(108, size)}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: {
          type: 'span',
          props: {
            style: {
              fontFamily: 'PlayfairBlack',
              fontWeight: 900,
              fontSize: `${sc(420, size)}px`,
              color: '#E3DAD1',
              lineHeight: 1,
              marginLeft: `${sc(15, size)}px`,
              marginBottom: `${sc(10, size)}px`,
            },
            children: 'C',
          },
        },
      },
    }) as ReactNode,
    {
      width: size,
      height: size,
      fonts: [{ name: 'PlayfairBlack', data: fontData, weight: 900, style: 'normal' }],
    },
  )

  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function main() {
  const sizes: [number, string][] = [
    [192, 'public/icons/icon-192.png'],
    [512, 'public/icons/icon-512.png'],
  ]

  for (const [size, outPath] of sizes) {
    const buf = await makeIcon(size)
    await sharp(buf).toFile(resolve(ROOT, outPath))
    console.log(`✅ ${outPath} (${size}×${size})`)
  }

  console.log('\nÍcones PWA gerados com sucesso.')
}

main().catch((e) => {
  console.error('Erro:', e)
  process.exit(1)
})
