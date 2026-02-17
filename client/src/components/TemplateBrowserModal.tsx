import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Template } from "@shared/schema";
import { Check, X, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";

interface TemplateBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
  selectedTemplateId?: number | null;
}

export function TemplateBrowserModal({
  open,
  onClose,
  onSelect,
  selectedTemplateId,
}: TemplateBrowserModalProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const templates = ENVATO_TEMPLATES;

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(templates.map(t => t.category)));
    return uniqueCategories.sort();
  }, [templates]);

  const filteredTemplates = templates.filter((template) => {
    return !selectedCategory || template.category === selectedCategory;
  });

  const handlePreview = (template: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleSelect = (template: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(template as Template);
  };

  const handlePreviewModalChange = (open: boolean) => {
    setIsPreviewOpen(open);
    if (!open) {
      setPreviewTemplate(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between bg-background sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-bold">{t("onboarding.templateSelection.browseTemplates") || "Browse Templates"}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("onboarding.templates.subtitle")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Category Filters */}
            <div className="border-b px-6 py-4 bg-background sticky top-[73px] z-10">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  onClick={() => setSelectedCategory(null)}
                  size="sm"
                >
                  {t("onboarding.templates.allCategories")}
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                    size="sm"
                  >
                    {t(`onboarding.templates.categories.${category.toLowerCase()}`)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => {
                  const isSelected = selectedTemplateId === template.id;

                  return (
                    <div
                      key={template.id}
                      className={`group relative bg-card rounded-lg overflow-hidden transition-all border-2 ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                        }`}
                    >
                      {/* Template Preview Image */}
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        <img
                          src={template.preview}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />

                        {/* Selected Badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 z-10">
                            <Check className="h-4 w-4" />
                          </div>
                        )}

                        {/* Hover Overlay with Buttons */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 z-20">
                          <Button
                            onClick={(e) => handlePreview(template, e)}
                            variant="secondary"
                            size="lg"
                            className="w-3/4"
                            data-testid={`button-preview-${template.id}`}
                          >
                            <Eye className="h-5 w-5 mr-2" />
                            Preview
                          </Button>
                          <Button
                            onClick={(e) => handleSelect(template, e)}
                            variant="default"
                            size="lg"
                            className="w-3/4"
                            data-testid={`button-select-${template.id}`}
                          >
                            <Check className="h-5 w-5 mr-2" />
                            Select
                          </Button>
                        </div>

                        {/* Template Name at Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 group-hover:opacity-0 transition-opacity">
                          <h3 className="font-semibold text-white text-sm">{template.name}</h3>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TemplatePreviewModal
        template={previewTemplate}
        open={isPreviewOpen}
        onOpenChange={handlePreviewModalChange}
      />
    </>
  );
}
