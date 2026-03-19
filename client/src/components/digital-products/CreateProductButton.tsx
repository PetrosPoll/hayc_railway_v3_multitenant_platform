import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductType } from "@/types/digital-products";

interface Props {
  onSelect: (type: ProductType) => void;
}

const PRODUCT_OPTIONS: Array<{ type: ProductType; label: string }> = [
  { type: "course", label: "Course" },
];

export function CreateProductButton({ onSelect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" data-testid="button-create-product">
          <Plus className="h-4 w-4 mr-1" />
          + Create
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
