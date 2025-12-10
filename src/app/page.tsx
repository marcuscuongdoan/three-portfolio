"use client";

import { useState, useEffect } from "react";
import BaseLayout from "@/components/BaseLayout";
import { motion } from "framer-motion";

export default function Home() {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show text after a delay
    setTimeout(() => {
      setShowText(true);
    }, 1000);
  }, []);

  return (
    <BaseLayout
      showNavbar={true}
      cloudOpacity={0.3}
      maxClouds={50}
      enableCloudControls={true}
    >
      {/* Page-specific content */}
      <div className="w-full h-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-end">
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ 
            opacity: showText ? 1 : 0, 
            filter: showText ? "blur(0px)" : "blur(10px)" 
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center text-white"
        >
          <p className="text-lg mb-2 text-left">Welcome to</p>
          <h1 className="text-7xl font-bold mb-4">Portfolio</h1>
          <p className="text-sm text-right">by Marcus - Cuong Doan</p>
        </motion.div>
      </div>
    </BaseLayout>
  );
}
