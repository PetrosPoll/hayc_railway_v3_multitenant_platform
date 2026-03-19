export type ProductStatus = "draft" | "published";

export type ProductType = "course";

export interface Product {
  id: string;
  type: ProductType;
  title: string;
  price: number;
  currency: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}
