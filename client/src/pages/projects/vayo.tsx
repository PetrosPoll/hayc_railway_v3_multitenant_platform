
import { ProjectShowcase, type ProjectDetails } from "@/components/ui/project-showcase";

const projectDetails: ProjectDetails = {
  id: 4,
  translationKey: "Vayo",
  images: [
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756766882/vayo2_ibrrty.webp",
    "https://res.cloudinary.com/dem12vqtl/image/upload/v1756766881/vayo1_xiqfcm.webp"
  ],
  url: "https://vayo.example.com",
  tech: ["Business", "Technology", "Innovation", "Consulting", "Solutions"],
};

export default function VayoProject() {
  return <ProjectShowcase project={projectDetails} />;
}
