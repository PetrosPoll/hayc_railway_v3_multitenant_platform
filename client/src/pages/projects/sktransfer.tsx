
import { ProjectShowcase, type ProjectDetails } from "@/components/ui/project-showcase";

const projectDetails: ProjectDetails = {
  id: 2,
  translationKey: "SkTransfer",
  images: [
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756702524/sktransfer1_seuxkq.webp",
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756702525/sktransfer2_gtwxtd.webp"
  ],
  url: "https://sktransfer.example.com",
  tech: ["Food", "Health", "Personal", "Repairs", "Entertainment"],
};

export default function SkTransferProject() {
  return <ProjectShowcase project={projectDetails} />;
}
