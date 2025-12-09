"use client";

import { useState, useEffect } from "react";
import World3DCanvas from "@/components/World3DCanvas";
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";

export default function Home() {
  const [showNavbar, setShowNavbar] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    setShowNavbar(true);
    setTimeout(() => {
      setShowText(true);
    }, 600);
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-black relative">
      {/* Navbar */}
      <Navbar show={showNavbar} />
      
      <div className="absolute inset-0 pt-16">
        <World3DCanvas className="w-full h-full" />
      </div>
      
      <div className="absolute inset-0 pt-16 pointer-events-none">
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
      </div>
    </main>
  );
}
