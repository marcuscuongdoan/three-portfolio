// Small decorative pieces shared by the League-themed sections

interface LolDividerProps {
  align?: "center" | "left" | "right";
  className?: string;
}

// Gold line with a diamond, like the client's section separators
export function LolDivider({ align = "center", className = "" }: LolDividerProps) {
  const fadeLeft = align !== "left";
  const fadeRight = align !== "right";
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden>
      <span
        className={`h-px flex-1 ${fadeLeft ? "bg-gradient-to-r from-transparent to-lol-gold-400" : "bg-lol-gold-400"}`}
      />
      <span className="w-2 h-2 rotate-45 border border-lol-gold-200 bg-lol-void" />
      <span className="w-1.5 h-1.5 rotate-45 bg-lol-gold-200" />
      <span className="w-2 h-2 rotate-45 border border-lol-gold-200 bg-lol-void" />
      <span
        className={`h-px flex-1 ${fadeRight ? "bg-gradient-to-l from-transparent to-lol-gold-400" : "bg-lol-gold-400"}`}
      />
    </div>
  );
}

interface LolSectionTitleProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}

export function LolSectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className = "",
}: LolSectionTitleProps) {
  const alignText = align === "center" ? "text-center" : "text-center sm:text-left";
  return (
    <div className={`${alignText} ${className}`}>
      <p className="font-lol text-xs sm:text-sm tracking-[0.35em] uppercase text-lol-blue-200 mb-2">
        {eyebrow}
      </p>
      <h2 className="font-lol font-bold uppercase tracking-wider text-4xl md:text-5xl lol-gold-text pb-1">
        {title}
      </h2>
      <LolDivider
        align={align === "center" ? "center" : "left"}
        className={`my-4 ${align === "center" ? "max-w-md mx-auto" : "max-w-md mx-auto sm:mx-0"}`}
      />
      {subtitle && (
        <p className="text-base md:text-lg text-lol-grey-100 max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
