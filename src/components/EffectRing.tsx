
const SIZE = 168
const STROKE = 14
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

/** Ring gauge: how far toward a typical peak the estimate is right now. */
export function EffectRing({ pct, label, color, animKey }: { pct: number; label: string; color: string; animKey: string }) {
  const frac = Math.min(1, Math.max(0, pct / 100))
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--fill)" strokeWidth={STROKE} />
        {frac > 0 && (
          <circle
            key={animKey}
            className="ring-anim"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ ['--ring-full' as string]: `${C}px` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num text-[40px] leading-none">
          {Math.round(pct)}
          <span className="text-[22px] font-medium">%</span>
        </div>
        <div className="mt-1.5 text-[15px] font-semibold" style={{ color }}>
          {label}
        </div>
      </div>
    </div>
  )
}
