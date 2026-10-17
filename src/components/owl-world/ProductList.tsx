"use client";

import { ProjectSheet } from "@/components/ProjectSheet";
import ProjectsIcon from "@/components/ProjectsIcon";
import { useOwlWorld } from "@/components/owl-world/owlStore";
import type { ShowcaseApp } from "@/data/apps";

/** Phones: opens the project list, so nobody has to fly to the museum to find an app */
export function ProductListButton() {
  const open = useOwlWorld((s) => s.productList);
  return (
    <button
      type="button"
      onClick={() => useOwlWorld.getState().setProductList(true)}
      aria-label="All projects"
      aria-haspopup="dialog"
      aria-expanded={open}
      className="owl-glass pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full md:hidden"
    >
      <ProjectsIcon className="h-4 w-4 text-lantern" />
    </button>
  );
}

const close = () => useOwlWorld.getState().setProductList(false);
const pick = (app: ShowcaseApp) => {
  close();
  // Same "leave the owl's world?" step as clicking a card or a frame
  useOwlWorld.getState().setPendingApp(app);
};

export function ProductListSheet() {
  const open = useOwlWorld((s) => s.productList);
  return <ProjectSheet open={open} onClose={close} onPick={pick} />;
}
