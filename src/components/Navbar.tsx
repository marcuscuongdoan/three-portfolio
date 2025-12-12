"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface NavbarProps {
  show?: boolean;
}

export default function Navbar({ show = false }: NavbarProps) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string>("home");

  const navItems = [
    { name: "Home", href: "#home", isAnchor: true },
    { name: "Projects", href: "#projects", isAnchor: true },
    { name: "Contact", href: "#contact", isAnchor: true },
  ];

  useEffect(() => {
    if (pathname !== "/") return;

    const observerOptions = {
      root: null,
      rootMargin: "-50% 0px -50% 0px",
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe sections
    const sections = ["home", "projects", "contact"];
    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, item: typeof navItems[0]) => {
    if (item.isAnchor && pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(item.href.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const isActive = (item: typeof navItems[0]) => {
    if (pathname !== "/") {
      return pathname === item.href;
    }
    if (item.isAnchor) {
      return activeSection === item.href.substring(1);
    }
    return false;
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: show ? 0 : -100, opacity: show ? 1 : 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 z-50 w-full pointer-events-none flex justify-center"
    >
      <div className="pt-4 sm:pt-6 px-4 sm:px-0">
        <div className="relative inline-flex items-center bg-white/90 backdrop-blur-md rounded-full p-1 sm:p-1.5 shadow-lg border border-gray-200 pointer-events-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => handleClick(e, item)}
              className={`relative px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                isActive(item)
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isActive(item) && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gray-900 rounded-full"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
