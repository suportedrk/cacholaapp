import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Cachola OS',
    template: '%s | Cachola OS',
  },
  description: 'Sistema operacional do Buffet Cachola',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cachola OS',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#7C8D78',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

/* Script inline executado ANTES da hidratação React para evitar flash de tema errado (FOUC). */
const themeScript = `
(function(){
  try{
    var t=localStorage.getItem('cachola-theme');
    var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
    if(dark){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}
    else{document.documentElement.setAttribute('data-theme','light');}
  }catch(e){}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Anti-FOUC: aplica o tema correto antes do primeiro paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning: extensões de browser (Dashlane, LastPass etc.)
          injetam atributos no <body> que causam mismatch de hidratação */}
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
