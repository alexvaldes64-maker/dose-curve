export function NowLine({ y, width }: { y: number; width: number }) {
  return (
    <div className="pointer-events-none absolute left-0 z-20" style={{ top: y, width }}>
      <div className="h-px w-full bg-text/80" />
      <span className="absolute left-2 top-0 -translate-y-1/2 rounded-full bg-text px-2 py-0.5 text-[11px] font-semibold text-card">Now</span>
    </div>
  )
}
