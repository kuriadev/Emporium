import type { PricingResult } from "./pricing";

export type CategoryKey = "gadgets" | "furniture" | "accessories" | "clothes";

export interface ImageRef {
  src: string;
  alt: string;
}

export interface Swatch {
  color: string;
  hex: string;
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategoryKey;
  tagline: string;
  price: number;
  compareAtPrice: number | null;
  images: ImageRef[];
  ratingAvg: number;
  ratingCount: number;
  totalStock: number;
  swatches: Swatch[];
  soldCount: number;
  createdAt: number;
  defaultVariantId: string | null;
  variantCount: number;
  tierPricing: boolean;
  materials: string;
  dimensions: string;
  specs: Record<string, string>;
}

export interface VariantView {
  id: string;
  sku: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  material: string | null;
  price: number;
  stock: number;
}

export interface ProductDetail extends ProductCardData {
  description: string;
  descriptionHtml: string;
  weightGrams: number;
  variants: VariantView[];
}

export interface CartLineView {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  image: ImageRef | null;
  unitPrice: number;
  quantity: number;
  stock: number;
  lineTotal: number;
  tierPricing: boolean;
}

export interface CartView {
  lines: CartLineView[];
  itemCount: number;
  totals: PricingResult;
  appliedBundles: { id: string; title: string; pct: number }[];
  issues: string[];
}

export interface ActionSuccess<T> {
  ok: true;
  data: T;
  message?: string;
}

export interface ActionFailure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
  retryAfter?: number;
}

export type ActionResult<T = null> = ActionSuccess<T> | ActionFailure;

export interface SearchSuggestion {
  products: Pick<ProductCardData, "id" | "slug" | "name" | "brand" | "price" | "images" | "category">[];
  categories: { key: CategoryKey; label: string }[];
  didYouMean: string | null;
  trending: string[];
  total: number;
}
