"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { name: "Home", id: "home" },
  { name: "Projects", id: "projects" },
  { name: "Contact", id: "contact" },
];

interface LolNavbarProps {
  show?: boolean;
}

export default function LolNavbar({ show = false }: LolNavbarProps) {
  const [activeSection, setActiveSection] = useState("home");

  // Highlight the section crossing the middle of the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: null, rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    NAV_ITEMS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    e.preventDefault();
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.nav
      aria-label="Main navigation"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: show ? 0 : -100, opacity: show ? 1 : 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 z-50 w-full pointer-events-none flex justify-center"
    >
      <div className="pt-4 sm:pt-6 px-4 sm:px-0">
        <div className="lol-frame flex items-center px-2 sm:px-4 pointer-events-auto">
          {NAV_ITEMS.map((item, i) => {
            const active = activeSection === item.id;
            return (
              <div key={item.id} className="flex items-center">
                {i > 0 && (
                  <span
                    aria-hidden
                    className="w-1.5 h-1.5 rotate-45 bg-lol-gold-400 mx-1 sm:mx-2"
                  />
                )}
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`relative font-lol font-semibold uppercase tracking-[0.15em] text-xs sm:text-sm px-3 sm:px-5 transition-colors duration-300 flex items-center ${
                    active
                      ? "text-lol-gold-100"
                      : "text-lol-grey-100 hover:text-lol-gold-200"
                  }`}
                  style={{ minHeight: "44px" }}
                >
                  {item.name}
                  {active && (
                    <motion.span
                      layoutId="lol-nav-active"
                      className="absolute left-2 right-2 bottom-1.5 h-0.5 bg-gradient-to-r from-transparent via-lol-gold-200 to-transparent shadow-[0_0_8px_rgba(200,170,110,0.8)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
