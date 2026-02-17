

export interface Project {
  id: number;
  translationKey: string;
  image: string;
  url: string;
  tech: string[];
}

export const PROJECTS: Project[] = [
  {
    id: 1,
    translationKey: "SkTransfer",
    image: "https://res.cloudinary.com/dem12vqtl/image/upload/v1756702524/sktransfer1_seuxkq.webp",
    url: "/projects/growthlabs",
    tech: ["Food", "Health", "Personal", "Repairs", "Entertainment"],
  },
  {
    id: 2,
    translationKey: "Vayo",
    image: "https://res.cloudinary.com/dem12vqtl/image/upload/v1756766882/vayo2_ibrrty.webp",
    url: "/projects/vayo",
    tech: ["Online Payments", "Beauty", "Gymnastics", "Photography", "Construction"],
  },
  {
    id: 3,
    translationKey: "GoldenServices",
    image: "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767103/goldenservice2_rsykk6.webp",
    url: "/projects/goldenservices",
    tech: ["Services", "Business", "Professional"],
  },
  {
    id: 4,
    translationKey: "DelliosGardenExperts",
    image: "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767713/dellios2_bjjvnc.webp",
    url: "/projects/delliosgardenexperts",
    tech: ["Garden", "Landscaping", "Experts"],
  },
  {
    id: 5,
    translationKey: "Ankologistics",
    image: "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767566/anko2_v4dmwf.webp",
    url: "/projects/ankologistics",
    tech: ["Logistics", "Transport", "Supply Chain", "Delivery"],
  },
  {
    id: 6,
    translationKey: "MarianthiKatsouda",
    image: "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767305/marianthi2_p1nxsy.webp",
    url: "/projects/marianthikatsouda",
    tech: ["Professional", "Portfolio", "Personal", "Services"],
  },
];
