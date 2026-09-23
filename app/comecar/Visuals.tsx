import { useId } from 'react'
import {
  BookOpen,
  BriefcaseBusiness,
  Cloud,
  Compass,
  Footprints,
  Heart,
  Infinity as InfinityIcon,
  Leaf,
  Lightbulb,
  Rocket,
  Search,
  Signpost,
  Sprout,
  Sun,
  Sunrise,
  Timer,
  TreeDeciduous,
  Wallet,
  type LucideIcon
} from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  cloud: Cloud,
  compass: Compass,
  footprints: Footprints,
  heart: Heart,
  infinity: InfinityIcon,
  leaf: Leaf,
  rocket: Rocket,
  search: Search,
  signpost: Signpost,
  sprout: Sprout,
  seed: Sprout,
  sun: Sun,
  sunrise: Sunrise,
  clock: Timer,
  tree: TreeDeciduous,
  wallet: Wallet,
  idea: Lightbulb
}

export function DreamIcon({
  name,
  size = 22
}: {
  name: string
  size?: number
}) {
  const Icon = icons[name] || Sprout
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />
}

export function MandalaBloom({
  progress = 8,
  compact = false
}: {
  progress?: number
  compact?: boolean
}) {
  const gradientId = useId()
  const colors = [
    'var(--color-indigo-200)',
    'var(--color-violet-200)',
    'var(--color-purple-200)',
    'var(--color-violet-300)',
    'var(--color-indigo-300)',
    'var(--color-violet-200)',
    'var(--color-indigo-200)',
    'var(--color-purple-200)'
  ]
  return (
    <div
      className={`bloom ${compact ? 'bloom-compact' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 480 480" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="var(--brand-start)" />
            <stop offset="1" stopColor="var(--brand-end)" />
          </linearGradient>
        </defs>
        <circle
          cx="240"
          cy="240"
          r="201"
          stroke="var(--color-indigo-200)"
          strokeDasharray="2 7"
        />
        <circle cx="240" cy="240" r="151" stroke="var(--color-indigo-200)" />
        {colors.map((color, i) => (
          <g
            key={i}
            transform={`rotate(${i * 45} 240 240)`}
            className={i < progress ? 'bloom-petal is-grown' : 'bloom-petal'}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <path
              d="M240 232C213 214 181 181 185 143C189 113 219 87 240 73C261 87 291 113 295 143C299 181 267 214 240 232Z"
              fill={i < progress ? color : 'var(--color-slate-200)'}
              stroke="var(--color-slate-50)"
              strokeWidth="3"
            />
            <path d="M240 91V210" stroke="#fff" strokeOpacity=".6" />
          </g>
        ))}
        <circle cx="240" cy="240" r="51" fill="var(--color-slate-50)" />
        <rect
          x="204"
          y="204"
          width="72"
          height="72"
          rx="24"
          fill={`url(#${gradientId})`}
          transform="rotate(12 240 240)"
        />
        <path
          d="m240 224 4.5 11.5L256 240l-11.5 4.5L240 256l-4.5-11.5L224 240l11.5-4.5L240 224Z"
          fill="#fff"
        />
        <circle cx="66" cy="141" r="5" fill="var(--color-violet-300)" />
        <circle cx="399" cy="341" r="5" fill="var(--color-indigo-300)" />
        <path
          d="M369 91v12m-6-6h12M114 373v10m-5-5h10"
          stroke="var(--color-violet-400)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function HeroArtwork() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art-wash" />
      <MandalaBloom />
      <span className="art-caption art-caption-top">TUDO COMEÇA COM VOCÊ</span>
      <div className="art-note">
        <span className="note-spark">✦</span>
        <span>
          um sonho seu<small>infinitas possibilidades</small>
        </span>
      </div>
      <div className="art-step">
        <span className="art-step-check">
          <Sprout size={22} />
        </span>
        <div>
          <small>SEU PRIMEIRO PASSO</small>
          <strong>Começar do seu jeito.</strong>
          <span>Uma coisa de cada vez.</span>
        </div>
      </div>
      <span className="art-caption art-caption-bottom">
        UM PEQUENO PASSO JÁ É UM COMEÇO.
      </span>
    </div>
  )
}
