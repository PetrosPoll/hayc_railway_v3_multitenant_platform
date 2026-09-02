export type ProductStatus = "draft" | "published";

export type ProductType = "course";

export type CourseAccessType = "lifetime" | "limited";

export interface Product {
  id: string;
  type: ProductType;
  title: string;
  price: number;
  currency: string;
  status: ProductStatus;
  accessType?: CourseAccessType;
  accessDays?: number | null;
  createdAt: string;
  updatedAt: string;
}
