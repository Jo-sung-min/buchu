import { Hero, IntroStrip } from "@/components/hero";
import { Catalog } from "@/components/catalog";
import { GuideBanner } from "@/components/guide-banner";
import { getPrograms } from "@/lib/programs";

export default async function Home() {
  const { items } = await getPrograms();
  return <><Hero /><IntroStrip /><Catalog programs={items} /><GuideBanner /></>;
}
