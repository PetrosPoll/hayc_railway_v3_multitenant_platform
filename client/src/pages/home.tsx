import { type User, type Subscription } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import "../i18n";

import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";
import { WhyUsSection } from "@/components/sections/why-us-section";
import { TemplatesSection } from "@/components/sections/templates-section";
import { AddonsSection } from "@/components/sections/addons-section";
import { HeroSection } from "@/components/sections/hero-section";

export default function Home() {
  // Example query for user data
  const { data } = useQuery<{ user: User | null }>({
    queryKey: ["/api/user"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: subscriptionList } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !!data?.user,
  });

  return (
    <div className="min-h-screen bg-background  mt-md-[65px]">
      <HeroSection />

      <WhyUsSection />

      {/* How We Work Section */}
      {/* <HowWeWorkSection /> */}

      <TemplatesSection />

      <AddonsSection />

      <TestimonialsSection />
      <FaqSection />
      <FinalCtaSection />
    </div>
  );
}
