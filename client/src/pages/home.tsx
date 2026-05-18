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
import { HowWeWorkSection } from "@/components/sections/how-we-work-section";

export default function Home() {
  const { data } = useQuery<{ user: User | null }>({
    queryKey: ["/api/user"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !!data?.user,
  });

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <HeroSection />

      <WhyUsSection />

      {/* How We Work — home_first bg */}
      <div className="relative w-full overflow-hidden pb-8">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] w-screen max-w-[100vw] bg-cover bg-center bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/public/images/home_first_mobile.png')] [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)] lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-cover bg-center bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/public/images/home_first_desktop.png')] [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)] lg:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] z-[1] h-40 w-screen max-w-[100vw] bg-gradient-to-b from-transparent to-black lg:h-48"
        />

        <div className="relative z-10 w-full">
          <HowWeWorkSection />
        </div>
      </div>

      <TemplatesSection />

      <AddonsSection />

      {/* Testimonials + FAQ — home_second bg */}
      <div className="relative -mt-24 w-full overflow-hidden pt-24 flex flex-col items-center px-4 lg:px-16 pb-16 lg:-mt-32 lg:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] w-screen max-w-[100vw] bg-cover bg-left-top bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/public/images/home_second_mobile.png')] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] hidden w-screen max-w-[100vw] bg-cover bg-left-top bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/public/images/home_second_desktop.png')] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] lg:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-[calc(50%-50vw)] z-[1] h-40 w-screen max-w-[100vw] bg-gradient-to-b from-black to-transparent lg:h-48"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] z-[1] h-32 w-screen max-w-[100vw] bg-gradient-to-b from-transparent to-black lg:h-40"
        />

        <div className="relative z-10 w-full flex flex-col items-center gap-12">
          <TestimonialsSection className="bg-transparent relative z-10" />
          <FaqSection className="bg-transparent relative z-10" />
        </div>
      </div>

      <FinalCtaSection />
    </div>
  );
}
