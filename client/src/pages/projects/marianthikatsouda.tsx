
import { ProjectShowcase, type ProjectDetails } from "@/components/ui/project-showcase";

const projectDetails: ProjectDetails = {
  id: 6,
  translationKey: "MarianthiKatsouda",
  images: [
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767305/marianthi2_p1nxsy.webp",
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767305/marianthi1_rgctad.webp"
  ],
  url: "https://marianthikatsouda.example.com",
  tech: ["Professional", "Portfolio", "Personal", "Services", "Consulting"],
};

export default function MarianthiKatsoudaProject() {
  return <ProjectShowcase project={projectDetails} />;
}
