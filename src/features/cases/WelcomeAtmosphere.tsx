/**
 * Decorative forensic / blueprint layer for the welcome wallpaper.
 * Purely visual — pointer-events none, aria-hidden.
 */
export function WelcomeAtmosphere() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--fx-atmosphere),transparent_58%)]" />

      <div className="fx-atm-sweep absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,transparent,var(--fx-deco),transparent)] opacity-40" />

      {/* Corner brackets — evidence frame */}
      <Corner className="top-16 left-6 md:top-20 md:left-10" />
      <Corner className="top-16 right-6 md:top-20 md:right-10" flipX />
      <Corner className="bottom-20 left-6 md:bottom-24 md:left-10" flipY />
      <Corner className="right-6 bottom-20 md:right-10 md:bottom-24" flipX flipY />

      {/* Orbit / crosshair */}
      <div className="fx-atm-pulse absolute top-[28%] right-[8%] hidden h-40 w-40 md:block lg:right-[12%]">
        <svg viewBox="0 0 160 160" className="h-full w-full text-[color:var(--fx-deco)]" fill="none">
          <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 5" />
          <circle cx="80" cy="80" r="48" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <circle cx="80" cy="80" r="4" fill="currentColor" opacity="0.55" />
          <path d="M80 20v18M80 122v18M20 80h18M122 80h18" stroke="currentColor" strokeWidth="0.75" />
          <path d="M110 50l14-8M110 50l8 14" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
        </svg>
      </div>

      {/* Node graph */}
      <svg
        className="fx-atm-drift absolute bottom-[18%] left-[6%] hidden h-36 w-48 text-[color:var(--fx-deco-strong)] sm:block"
        viewBox="0 0 192 144"
        fill="none"
      >
        <path
          d="M24 96L56 48L104 64L140 28L168 72"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity="0.55"
        />
        <path d="M56 48L72 100L104 64" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
        {[
          [24, 96],
          [56, 48],
          [104, 64],
          [140, 28],
          [168, 72],
          [72, 100],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.4" fill="currentColor" />
        ))}
      </svg>

      <div className="absolute top-[22%] left-0 hidden h-px w-28 bg-[color:var(--fx-deco)] md:block" />
      <div className="absolute top-[22%] left-0 hidden h-3 w-px bg-[color:var(--fx-deco)] md:block" />
      <div className="absolute right-0 bottom-[32%] hidden h-px w-36 bg-[color:var(--fx-deco)] md:block" />
      <div className="absolute right-0 bottom-[32%] hidden h-3 w-px bg-[color:var(--fx-deco)] md:block" />

      <div className="fx-atm-fade absolute top-[22%] left-8 hidden font-mono text-[9px] tracking-[0.16em] text-[color:var(--fx-hash)] uppercase md:block">
        GRID 48 · ORIGIN 0,0
      </div>
      <div
        className="fx-atm-drift absolute top-[38%] right-[6%] hidden max-w-[11rem] font-mono text-[9px] leading-4 tracking-wider text-[color:var(--fx-hash)] md:block"
        style={{ animationDelay: '2s' }}
      >
        SHA-256
        <br />
        a7f3…c91e
        <br />
        CHAIN · IMMUTABLE
      </div>
      <div
        className="fx-atm-drift absolute bottom-[28%] right-[10%] hidden font-mono text-[9px] tracking-[0.2em] text-[color:var(--fx-hash)] uppercase lg:block"
        style={{ animationDelay: '4s' }}
      >
        EVIDENCE · LOCAL
      </div>
      <div className="absolute bottom-[14%] left-[28%] hidden font-mono text-[9px] tracking-[0.18em] text-[color:var(--fx-hash)] uppercase sm:block">
        X:124 · Y:086 · Δt 0ms
      </div>

      {[
        'top-[18%] left-[22%]',
        'top-[42%] left-[14%]',
        'top-[55%] right-[22%]',
        'bottom-[22%] left-[42%]',
        'top-[30%] right-[30%]',
      ].map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} hidden h-2.5 w-2.5 text-[color:var(--fx-deco)] sm:block`}
        >
          <svg viewBox="0 0 10 10" className="h-full w-full" fill="none">
            <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        </span>
      ))}

      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-32deg, transparent, transparent 11px, var(--fx-grid-line) 11px, var(--fx-grid-line) 12px)',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 70% 25%, black 0%, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 70% 25%, black 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

function Corner({
  className,
  flipX,
  flipY,
}: {
  className: string
  flipX?: boolean
  flipY?: boolean
}) {
  const scale = `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
  return (
    <svg
      className={`absolute h-16 w-16 text-[color:var(--fx-deco-strong)] ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      style={{ transform: scale }}
    >
      <path d="M2 18V2h16" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 8h10M8 8v10" stroke="currentColor" strokeWidth="0.75" opacity="0.45" />
    </svg>
  )
}
