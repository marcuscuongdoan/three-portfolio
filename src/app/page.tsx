"use client";

import BaseLayout from "@/components/BaseLayout";
import Home from "@/components/Home";
import Projects from "@/components/Projects";
import Contact from "@/components/Contact";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function Page() {
  const isMobile = useIsMobile(640);
  
  return (
    <BaseLayout
      showNavbar={true}
      cloudOpacity={0.3}
      maxClouds={50}
      enableCloudControls={true}
      className={isMobile ? "" : "snap-y snap-mandatory"}
    >
      {/* Home Section */}
      <Home />

      {/* Projects Section */}
      <Projects />

      {/* Contact Section */}
      <Contact />
    </BaseLayout>
  );
}
