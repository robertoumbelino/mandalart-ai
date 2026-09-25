import './onboarding.css'

export default function BeginLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="begin">{children}</div>
  )
}
