import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marcus Portfolio - Miss Fortune",
};

export default function MissFortuneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
