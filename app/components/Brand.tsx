import Image from 'next/image'

/** Shared identity: preserve the spelling, type, and gradient on every surface. */
export function BrandIcon({
  size = 32,
  className = ''
}: {
  size?: number
  className?: string
}) {
  return (
    <Image
      src="/mandalart-logo.svg"
      alt=""
      width={size}
      height={size}
      className={`brand-icon ${className}`}
    />
  )
}

export function BrandWordmark() {
  return (
    <span className="brand-wordmark">
      Mandalart<span className="brand-text">.AI</span>
    </span>
  )
}

export function BrandLogo({ iconSize = 32 }: { iconSize?: number }) {
  return (
    <span className="brand-logo">
      <BrandIcon size={iconSize} />
      <BrandWordmark />
    </span>
  )
}
