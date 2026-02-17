import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { Template } from "@shared/schema";

export default function TemplateDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  
  const { data: template, isLoading } = useQuery<Template>({
    queryKey: [`/api/templates/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-[65px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto px-4 py-8 mt-[65px]">
        <p className="text-muted-foreground">Template not found</p>
      </div>
    );
  }

  // Check if template has translation key (meaning it has full content)
  const hasFullContent = template.translationKey && 
    i18n.exists(`templates.items.${template.translationKey}.fullDescription`);

  // Coming Soon Page for templates without full content
  if (!hasFullContent) {
    return (
      <div className="container mx-auto px-4 mt-[65px] py-12">
        <Link to="/templates">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("templates.backToTemplates")}
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="grid gap-8 md:grid-cols-2 mb-12">
            {template.images.map((image, index) => (
              <div key={index} className="bg-card rounded-lg overflow-hidden">
                <img
                  src={image}
                  alt={`${template.name} preview ${index + 1}`}
                  className="w-full h-auto"
                />
              </div>
            ))}
          </div>

          <div className="text-center space-y-6 py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <Clock className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">{template.name}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {template.description}
            </p>
            
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-muted rounded-full">
              <span className="text-sm font-medium">Coming Soon</span>
            </div>

            <p className="text-muted-foreground max-w-xl mx-auto pt-4">
              This template page is being prepared. Check back soon for more details, features, and a full description.
            </p>

            <div className="pt-8">
              <Link to="/templates">
                <Button variant="default">
                  Browse Other Templates
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full Template Detail Page for templates with translation content
  return (
    <div className="container mx-auto px-4 mt-[65px] py-12">
      <Link to="/templates">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("templates.backToTemplates")}
        </Button>
      </Link>

      <div className="grid gap-8 md:grid-cols-2 mb-12">
        {template.images.map((image, index) => (
          <div key={index} className="bg-card rounded-lg overflow-hidden">
            <img
              src={image}
              alt={`${template.name} preview ${index + 1}`}
              className="w-full h-auto"
            />
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <h1 className="text-4xl font-bold">
          {t(`templates.items.${template.translationKey}.name`)}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t(`templates.items.${template.translationKey}.description`)}
        </p>

        <div className="prose prose-lg max-w-none">
          <h2 className="text-2xl font-semibold mb-4">
            {t("templates.features")}
          </h2>
          <ul className="list-disc pl-6">
            {Object.entries(
              t(`templates.items.${template.translationKey}.features`, {
                returnObjects: true,
              }) as Record<string, string>,
            ).map(([key, value]) => (
              <li key={key}>{value}</li>
            ))}
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">
            {t("templates.description")}
          </h2>
          <p>
            {t(`templates.items.${template.translationKey}.fullDescription`)}
          </p>
        </div>

        <div className="flex gap-4 mt-8">
          <Link to="/templates">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("templates.backToTemplates")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
