import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ProductType } from "@/types/digital-products";

interface Props {
  types: ProductType[];
  active: ProductType | null;
  onChange: (type: ProductType) => void;
}

export function ProductTypeFilter({ types, active, onChange }: Props) {
  const { t } = useTranslation();

  function getTypeLabel(type: ProductType): string {
    if (type === "course") return t("digitalProductsManagement.filters.courses");
    return t("digitalProductsManagement.filters.products");
  }

  if (types.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {types.map((type) => (
        <Button
          key={type}
          type="button"
          size="sm"
          variant={active === type ? "default" : "outline"}
          onClick={() => onChange(type)}
          data-testid={`product-type-pill-${type}`}
        >
          {getTypeLabel(type)}
        </Button>
      ))}
    </div>
  );
}
