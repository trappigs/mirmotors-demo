import { DemoBanner, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
