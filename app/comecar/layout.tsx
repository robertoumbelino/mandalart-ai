import localFont from 'next/font/local'
import './onboarding.css'

const sans = localFont({
  src: './fonts/dm-sans-normal.woff2',
  variable: '--begin-sans',
  weight: '400 700',
  display: 'swap'
})
const serif = localFont({
  src: [
    { path: './fonts/lora-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/lora-italic.woff2', weight: '500', style: 'italic' }
  ],
  variable: '--begin-serif',
  display: 'swap'
})

export default function BeginLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${sans.variable} ${serif.variable} begin`}>{children}</div>
  )
}
