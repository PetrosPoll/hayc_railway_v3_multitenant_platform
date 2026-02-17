import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Template } from "@shared/schema";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";

export default function Templates() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // const { data: templates = [], isLoading } = useQuery<Template[]>({
  //   queryKey: ['/api/templates'],
  // });

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set([ ...ENVATO_TEMPLATES].map(t => t.category)));
    return uniqueCategories.sort();
  }, [ ENVATO_TEMPLATES]);

  const filteredTemplates = [...ENVATO_TEMPLATES].filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  };

  return (
    <div className="min-h-screen bg-background mt-[65px]">
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              {t("templates.title")}
            </h2>
            <p className="text-lg text-[#182B53]">
              {t("templates.subtitle")}
            </p>
          </div>

          <div className="mb-8 space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
              >
                {t("templates.allCategories")}
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                  onClick={() => setSelectedCategory(category)}
                >
                  {t(`onboarding.templates.categories.${category.toLowerCase()}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading templates...</p>
            </div>
          ) : ( */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className="bg-card rounded-lg overflow-hidden transition-transform hover:scale-[1.02] cursor-pointer"
                data-testid={`card-template-${template.id}`}
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={template.preview}
                    alt={template.name}
                    className="w-full h-full object-cover border"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">
                    {template.name}
                  </h3>
                </div>
              </div>
            ))}
            </div>
          {/* )} */}
        </div>
      </section>
      
      <TemplatePreviewModal 
        template={selectedTemplate}
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
      />
    </div>
  );
}