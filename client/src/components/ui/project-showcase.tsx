import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Code2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface ProjectDetails {
  id: number;
  translationKey: string;
  images: string[];
  url: string;
  tech: string[];
}

const PROJECT_ROUTES = [
  "/projects/growthlabs",
  "/projects/vayo",
  "/projects/goldenservices",
  "/projects/delliosgardenexperts",
  "/projects/ankologistics",
  "/projects/marianthikatsouda"
];

export function ProjectShowcase({ project }: { project: ProjectDetails }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const getNextProject = () => {
    // Create a mapping of translation keys to routes
    const keyToRoute: { [key: string]: string } = {
      'SkTransfer': '/projects/growthlabs',
      'Vayo': '/projects/vayo',
      'GoldenServices': '/projects/goldenservices',
      'DelliosGardenExperts': '/projects/delliosgardenexperts',
      'Ankologistics': '/projects/ankologistics',
      'MarianthiKatsouda': '/projects/marianthikatsouda'
    };
    
    const currentRoute = keyToRoute[project.translationKey];
    const currentIndex = PROJECT_ROUTES.findIndex(route => route === currentRoute);
    const nextIndex = (currentIndex + 1) % PROJECT_ROUTES.length;
    return PROJECT_ROUTES[nextIndex];
  };

  const handleNextProject = () => {
    const nextRoute = getNextProject();
    navigate(nextRoute);
  };

  return (
    <div className="min-h-screen bg-background pt-16 pb-24">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6 hover:bg-muted"
          asChild
        >
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t(`projects.backToHome`)}
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Images */}
          <div className="space-y-4">
            {project.images.map((image, index) => (
              <div key={index} className="aspect-video overflow-hidden rounded-lg">
                <img
                  src={image}
                  alt={`${t(`home.projects.items.${project.translationKey}.title`)} - Image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Right Column - Project Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-4">
                {t(`home.projects.items.${project.translationKey}.title`)}
              </h1>
              <p className="text-xl text-muted-foreground mb-6">
                {t(`home.projects.items.${project.translationKey}.description`)}
              </p>
              {/* <p className="text-lg leading-relaxed">
                {t(`home.projects.items.${project.translationKey}.fullDescription`)}
              </p> */}
            </div>

            {/* Add-ons */}
            {/* <Card>
              <CardHeader>
                <CardTitle>
                  Add-ons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card> */}

            {/* Challenge & Solution */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t(`projects.challenge`)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t(`home.projects.items.${project.translationKey}.challenge`)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t(`projects.solution`)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t(`home.projects.items.${project.translationKey}.solution`)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Next Project Button */}
            <Button onClick={handleNextProject} className="w-full">
              Next Project
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}