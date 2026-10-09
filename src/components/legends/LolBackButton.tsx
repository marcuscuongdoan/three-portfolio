import Link from "next/link";

// Back to the portfolio homepage; sits where the homepage's Legends panel is
export default function LolBackButton() {
  return (
    <div className="fixed z-40 bottom-4 left-4 sm:bottom-auto sm:top-6 sm:left-6">
      <Link
        href="/"
        aria-label="Back to portfolio"
        className="lol-frame group flex items-center gap-3 p-2 sm:pr-5"
      >
        <span
          aria-hidden
          className="w-9 h-9 rounded-full border-2 border-lol-gold-400 bg-lol-void flex items-center justify-center text-lol-gold-200 transition-all group-hover:border-lol-gold-200 group-hover:text-lol-gold-100 group-hover:shadow-[0_0_10px_rgba(200,170,110,0.6)]"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeWidth={2} d="M15 5l-7 7 7 7" />
          </svg>
        </span>
        <span aria-hidden className="hidden sm:block leading-tight">
          <span className="block font-lol text-[10px] tracking-[0.3em] uppercase text-lol-blue-200">
            Return
          </span>
          <span className="block font-lol text-sm font-semibold uppercase tracking-wider text-lol-gold-100 group-hover:text-white transition-colors">
            Portfolio
          </span>
        </span>
      </Link>
    </div>
  );
}
