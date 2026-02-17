
import { ProjectShowcase, type ProjectDetails } from "@/components/ui/project-showcase";

const projectDetails: ProjectDetails = {
  id: 5,
  translationKey: "Ankologistics",
  images: [
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767566/anko2_v4dmwf.webp",
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767566/anko1_dmrvdc.webp"
  ],
  url: "https://ankologistics.example.com",
  tech: ["Logistics", "Transport", "Supply Chain", "Delivery", "Warehouse"],
};

export default function AnkologisticsProject() {
  return <ProjectShowcase project={projectDetails} />;
}
