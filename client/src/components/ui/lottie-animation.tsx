import Lottie from "lottie-react";
import { useInView } from "@/hooks/use-in-view";
import { useEffect, useState } from "react";

interface LottieAnimationProps {
  desktopSrc: string;
  mobileSrc: string;
  className?: string;
}

export function LottieAnimation({
  desktopSrc,
  mobileSrc,
  className = "",
}: LottieAnimationProps) {
  const { ref, inView } = useInView(0.3);
  const [isMobile, setIsMobile] = useState(false);
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!inView) return;
    const src = isMobile ? mobileSrc : desktopSrc;
    fetch(src)
      .then((res) => res.json())
      .then((data) => setAnimationData(data));
  }, [inView, isMobile, desktopSrc, mobileSrc]);

  return (
    <div ref={ref} className={className}>
      {animationData && <Lottie animationData={animationData} loop={false} autoplay={true} />}
    </div>
  );
}
