import Link from "next/link";

function EntryLink({
  href,
  label,
  kicker,
  title,
  icon,
}: {
  href: string;
  label: string;
  kicker: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group flex items-center gap-3 p-1.5 sm:pr-4 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
    >
      <span
        aria-hidden
        className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center overflow-hidden"
      >
        {icon}
      </span>
      <span aria-hidden className="hidden sm:block leading-tight">
        <span className="block text-[10px] uppercase tracking-widest text-gray-500">{kicker}</span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
      </span>
      <svg
        aria-hidden
        className="hidden sm:block w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// Homepage entry points to the side pages: the Legends Trial campfire and the
// Africa Twin exploded view (top-left, stacked; icon-only row on mobile)
export default function LegendsPanel() {
  return (
    <div className="fixed z-40 bottom-4 left-4 flex gap-2 sm:bottom-auto sm:top-6 sm:left-6 sm:flex-col sm:items-start">
      <EntryLink
        href="/trial"
        label="Legends Trial"
        kicker="Legends"
        title="Trial"
        icon={
          <span className="w-3.5 h-3.5 rotate-45 border-2 border-amber-300 group-hover:bg-amber-300 transition-colors" />
        }
      />
      <EntryLink
        href="/africa-twin"
        label="Honda Africa Twin"
        kicker="Honda"
        title="Africa Twin"
        icon={
          // Tricolour stripes, sliding on hover
          <span className="flex w-6 h-3.5 -skew-x-12 overflow-hidden rounded-xs group-hover:translate-x-0.5 transition-transform">
            <span className="flex-1 bg-[#e4002b]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#1f3a93]" />
          </span>
        }
      />
    </div>
  );
}
