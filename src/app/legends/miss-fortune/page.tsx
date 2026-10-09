"use client";

import { useState } from "react";
import BaseLayout from "@/components/BaseLayout";
import LegendHome from "@/components/legends/LegendHome";
import LegendProjects from "@/components/legends/LegendProjects";
import LegendContact from "@/components/legends/LegendContact";
import LolBackground from "@/components/legends/LolBackground";
import LolNavbar from "@/components/legends/LolNavbar";
import LolBackButton from "@/components/legends/LolBackButton";
import MissFortuneSkinPanel from "@/components/MissFortuneSkinPanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MISS_FORTUNE_MODELS, MissFortuneVariant } from "@/config/missFortune";

export default function MissFortunePage() {
  const isMobile = useIsMobile(640);
  const [skin, setSkin] = useState<MissFortuneVariant>("base");

  return (
    <BaseLayout
      character="miss-fortune"
      characterModelPath={MISS_FORTUNE_MODELS[skin]}
      background={<LolBackground />}
      renderNavbar={(show) => <LolNavbar show={show} />}
      overlay={
        <>
          <LolBackButton />
          <MissFortuneSkinPanel value={skin} onChange={setSkin} />
        </>
      }
      className={isMobile ? "" : "snap-y snap-mandatory"}
    >
      <LegendHome />
      <LegendProjects />
      <LegendContact />
    </BaseLayout>
  );
}
