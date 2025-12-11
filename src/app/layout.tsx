import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Marcus Portfolio - 3D Character Showcase",
  description: "Explore my interactive 3D portfolio featuring Three.js character animations and web development projects. Built with Next.js and modern web technologies.",
  keywords: ["Marcus", "Portfolio", "Three.js", "3D", "Web Development", "Next.js", "React", "Interactive"],
  authors: [{ name: "Marcus Cuong Doan" }],
  creator: "Marcus Cuong Doan",
  metadataBase: new URL('https://marcus-three-portfolio.vercel.app'), // Update this with your actual domain
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://marcus-three-portfolio.vercel.app", // Update this with your actual domain
    title: "Marcus Portfolio - 3D Character Showcase",
    description: "Explore my interactive 3D portfolio featuring Three.js character animations and web development projects. Built with Next.js and modern web technologies.",
    siteName: "Marcus Portfolio",
    images: [
      {
        url: "/og-image.png", // You'll need to add this image to your public folder
        width: 1200,
        height: 630,
        alt: "Marcus Portfolio - 3D Character Showcase",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marcus Portfolio - 3D Character Showcase",
    description: "Explore my interactive 3D portfolio featuring Three.js character animations and web development projects.",
    images: ["/og-image.png"], // You'll need to add this image to your public folder
    creator: "@carrynology", // Update with your Twitter handle
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
