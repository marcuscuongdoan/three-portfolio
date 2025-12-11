import { forwardRef, ReactNode } from "react";

interface SectionLayoutProps {
  id: string;
  children: ReactNode;
  className?: string;
}

const SectionLayout = forwardRef<HTMLElement, SectionLayoutProps>(
  ({ id, children, className = "" }, ref) => {
    return (
      <section
        id={id}
        ref={ref}
        className={`w-full h-screen flex items-center justify-center overflow-hidden relative snap-start ${className}`}
        style={{ 
          scrollSnapStop: 'always',
          scrollSnapAlign: 'start'
        }}
      >
        {children}
      </section>
    );
  }
);

SectionLayout.displayName = "SectionLayout";

export default SectionLayout;
