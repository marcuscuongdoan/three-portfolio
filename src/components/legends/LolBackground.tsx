// Dark hextech backdrop: gradient glows, hex grid, rune rings and gold embers

const EMBER_COUNT = 28;

// Deterministic pseudo-random so server and client render the same embers
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

// Rounded: browsers normalize long decimals in inline styles, which would
// otherwise trip a hydration mismatch
const round = (n: number) => Math.round(n * 100) / 100;

const embers = Array.from({ length: EMBER_COUNT }, (_, i) => ({
  left: round(rand(i) * 100),
  size: round(1.5 + rand(i + 100) * 2.5),
  duration: round(12 + rand(i + 200) * 16),
  delay: round(-rand(i + 300) * 28),
  drift: round((rand(i + 400) - 0.5) * 120),
  opacity: round(0.4 + rand(i + 500) * 0.5),
}));

export default function LolBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-lol-void" aria-hidden>
      {/* Base gradient + glows (hextech behind the character, gold up top) */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 45% 55% at 28% 62%, rgba(10, 200, 185, 0.16), transparent 70%)",
            "radial-gradient(ellipse 60% 40% at 75% 0%, rgba(200, 155, 60, 0.14), transparent 70%)",
            "linear-gradient(180deg, #010A13 0%, #0A1428 55%, #010A13 100%)",
          ].join(","),
        }}
      />

      {/* Hex grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
        <defs>
          <pattern
            id="lol-hex"
            width="56"
            height="97"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(0.8)"
          >
            <path
              d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 64 L28 97"
              fill="none"
              stroke="#C8AA6E"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lol-hex)" />
      </svg>

      {/* Rune rings behind the character */}
      <div className="absolute left-[28%] top-[62%] -translate-x-1/2 -translate-y-1/2 w-[70vh] h-[70vh] opacity-40">
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full lol-spin-slow">
          <circle cx="100" cy="100" r="96" fill="none" stroke="#785A28" strokeWidth="0.6" />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="#C8AA6E"
            strokeWidth="0.8"
            strokeDasharray="1 6"
          />
        </svg>
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full lol-spin-slower">
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="#0AC8B9"
            strokeWidth="0.5"
            strokeDasharray="24 8 2 8"
            opacity="0.7"
          />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <path
              key={deg}
              d="M100 17 L103 22 L100 27 L97 22 Z"
              fill="#C8AA6E"
              transform={`rotate(${deg} 100 100)`}
            />
          ))}
        </svg>
      </div>

      {/* Embers */}
      {embers.map((ember, i) => (
        <span
          key={i}
          className="lol-ember"
          style={
            {
              left: `${ember.left}%`,
              width: ember.size,
              height: ember.size,
              animationDuration: `${ember.duration}s`,
              animationDelay: `${ember.delay}s`,
              "--ember-drift": `${ember.drift}px`,
              "--ember-opacity": ember.opacity,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(1, 10, 19, 0.85) 100%)",
        }}
      />
    </div>
  );
}
