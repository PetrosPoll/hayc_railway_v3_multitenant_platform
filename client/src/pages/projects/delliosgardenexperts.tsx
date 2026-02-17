
import { ProjectShowcase, type ProjectDetails } from "@/components/ui/project-showcase";

const projectDetails: ProjectDetails = {
  id: 6,
  translationKey: "DelliosGardenExperts",
  images: [
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767713/dellios2_bjjvnc.webp",
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756767713/dellios1_qwv1mp.webp"
  ],
  url: "https://delliosgardenexperts.example.com",
  tech: ["Gardening", "Landscaping", "Plant Care", "Garden Design", "Outdoor"],
};

export default function DelliosGardenExpertsProject() {
  return <ProjectShowcase project={projectDetails} />;
}
