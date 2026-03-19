import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { ProductType } from "@/types/digital-products";

interface Props {
  onSelect: (type: ProductType) => void;
}

export function CreateProductButton({ onSelect }: Props) {
  const { t } = useTranslation();

  const PRODUCT_OPTIONS: Array<{ type: ProductType; label: string }> = [
    { type: "course", label: t("digitalProductsManagement.create.courseOption") },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" data-testid="button-create-product">
          <Plus className="h-4 w-4 mr-1" />
          {t("digitalProductsManagement.create.button")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PRODUCT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.type}
            onClick={() => onSelect(option.type)}
            data-testid={`create-product-option-${option.type}`}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
