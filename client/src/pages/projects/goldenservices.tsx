
import { ProjectShowcase, type ProjectDetails } from "@/components/ui/project-showcase";

const projectDetails: ProjectDetails = {
  id: 5,
  translationKey: "GoldenServices",
  images: [
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767103/goldenservice2_rsykk6.webp",
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767103/goldenservices1_mcmwsk.webp"
  ],
  url: "https://goldenservices.example.com",
  tech: ["Premium", "Services", "Quality", "Customer Care", "Excellence"],
};

export default function GoldenServicesProject() {
  return <ProjectShowcase project={projectDetails} />;
}
