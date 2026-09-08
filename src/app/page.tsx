import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { Spaces } from "@/components/spaces";
import { Pricing } from "@/components/pricing";
import { Location } from "@/components/location";
import { Cta } from "@/components/cta";
import { Blog } from "@/components/blog";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Spaces />
        <Pricing />
        <Location />
        <Cta />
        <Blog />
      </main>
      <SiteFooter />
    </>
  );
}
