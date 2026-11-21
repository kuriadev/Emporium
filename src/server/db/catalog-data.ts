import type { BundleRule } from "@/lib/pricing";
import type { Category, ProductImage } from "./schema";

export interface SeedVariant {
  sku: string;
  color?: string;
  colorHex?: string;
  size?: string;
  material?: string;
  priceOverride?: number;
  stock: number;
  reorderThreshold?: number;
}

export interface SeedProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: Category;
  tagline: string;
  description: string;
  basePrice: number;
  compareAtPrice?: number;
  featured: boolean;
  tierPricing: boolean;
  images: ProductImage[];
  specs: Record<string, string>;
  materials: string;
  dimensions: string;
  weightGrams: number;
  soldCount: number;
  daysOld: number;
  variants: SeedVariant[];
}

const gallery = (key: string, name: string): ProductImage[] => [
  { src: `/images/products/${key}-1.webp`, alt: `${name}, front view` },
  { src: `/images/products/${key}-2.webp`, alt: `${name}, close-up detail` },
  { src: `/images/products/${key}-3.webp`, alt: `${name}, alternate angle` },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: "prd_airpods2",
    slug: "air-pods-2nd-gen",
    name: "Air Pods 2nd Gen",
    brand: "Apple",
    category: "gadgets",
    tagline: "Effortless audio that connects the moment you open the case.",
    description:
      "### Wireless, without the fuss\nUp to **5 hours** of listening on a single charge and more than **24 hours** with the charging case.\n\n- One-tap setup with your iPhone\n- Hey Siri, hands-free\n- Automatic switching across your devices\n\n#### What's in the box\n- AirPods, charging case, USB-C cable",
    basePrice: 8_490_00,
    compareAtPrice: 8_990_00,
    featured: true,
    tierPricing: false,
    images: gallery("airpods", "Air Pods 2nd Gen"),
    specs: { Chip: "H1", "Battery (buds)": "Up to 5 hrs", "Battery (with case)": "24+ hrs", Connectivity: "Bluetooth 5.0", Year: "2024" },
    materials: "Polycarbonate",
    dimensions: "Case 5.4 × 4.4 × 2.1 cm",
    weightGrams: 46,
    soldCount: 412,
    daysOld: 40,
    variants: [{ sku: "APL-AP2-WHT", color: "White", colorHex: "#f2f2f2", stock: 24, reorderThreshold: 6 }],
  },
  {
    id: "prd_visionpro",
    slug: "apple-vision-pro",
    name: "Apple Vision Pro",
    brand: "Apple",
    category: "gadgets",
    tagline: "Welcome to the future. Spatial computing, beautifully made.",
    description:
      "### Your apps, in your space\nVision Pro blends digital content with your physical surroundings so you stay present while you work, watch and connect.\n\n- Micro-OLED displays with 23 million pixels\n- Controlled with your eyes, hands and voice\n- Spatial Audio with personalised sound\n\nOr pay **₱1,200/mo. for 12 months** with participating banks.",
    basePrice: 20_000_00,
    featured: true,
    tierPricing: false,
    images: gallery("vision-pro", "Apple Vision Pro"),
    specs: { Chip: "M2 + R1", Display: "Micro-OLED, 23M pixels", Battery: "Up to 2 hrs", Weight: "600–650 g" },
    materials: "Laminated glass, aluminium, knit band",
    dimensions: "Varies by Light Seal",
    weightGrams: 650,
    soldCount: 58,
    daysOld: 6,
    variants: [
      { sku: "APL-AVP-256", size: "256GB", stock: 3, reorderThreshold: 4 },
      { sku: "APL-AVP-512", size: "512GB", priceOverride: 22_500_00, stock: 0, reorderThreshold: 2 },
    ],
  },
  {
    id: "prd_iphone15pro",
    slug: "iphone-15-pro",
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "gadgets",
    tagline: "Titanium. So strong. So light. So Pro.",
    description:
      "### Forged in titanium\nAerospace-grade titanium design with the A17 Pro chip, a customisable Action button and the most powerful iPhone camera system yet.\n\n- 48MP Main camera with 5x Telephoto\n- USB-C with USB 3 speeds\n- All-day battery life",
    basePrice: 69_990_00,
    featured: true,
    tierPricing: false,
    images: gallery("iphone-15-pro", "iPhone 15 Pro"),
    specs: { Chip: "A17 Pro", Display: "6.1\" Super Retina XDR", Camera: "48MP Main + 5x Telephoto", Port: "USB-C (USB 3)" },
    materials: "Titanium, textured matte glass",
    dimensions: "14.7 × 7.1 × 0.8 cm",
    weightGrams: 187,
    soldCount: 133,
    daysOld: 18,
    variants: [
      { sku: "APL-IP15P-NT-128", color: "Natural Titanium", colorHex: "#bfb8ad", size: "128GB", stock: 9 },
      { sku: "APL-IP15P-NT-256", color: "Natural Titanium", colorHex: "#bfb8ad", size: "256GB", priceOverride: 76_990_00, stock: 5 },
      { sku: "APL-IP15P-BT-128", color: "Black Titanium", colorHex: "#3b3b3d", size: "128GB", stock: 4, reorderThreshold: 5 },
      { sku: "APL-IP15P-BT-256", color: "Black Titanium", colorHex: "#3b3b3d", size: "256GB", priceOverride: 76_990_00, stock: 2 },
    ],
  },
  {
    id: "prd_catplush",
    slug: "black-cat-plushie",
    name: "Black Cat Plushie",
    brand: "Emporium Home",
    category: "furniture",
    tagline: "FLUFFY CAT!! Cute, isn't it? A floor cushion with personality.",
    description:
      "### A cushion that purrs (figuratively)\nUltra-soft velvet shell over a high-rebound cotton fill. Doubles as a lumbar pillow, reading cushion or the cutest corner piece in the room.\n\n- Machine-washable cover\n- Hypoallergenic fill\n- Hand-stitched whiskers",
    basePrice: 299_00,
    compareAtPrice: 399_00,
    featured: true,
    tierPricing: true,
    images: gallery("cat-plushie", "Black Cat Plushie"),
    specs: { Fill: "PP cotton", Care: "Removable, machine-washable cover", Age: "3+" },
    materials: "Short-pile velvet, PP cotton",
    dimensions: "Small 30 cm · Large 45 cm",
    weightGrams: 420,
    soldCount: 905,
    daysOld: 90,
    variants: [
      { sku: "EMH-CAT-S", size: "Small (30 cm)", stock: 40, reorderThreshold: 10 },
      { sku: "EMH-CAT-L", size: "Large (45 cm)", priceOverride: 449_00, stock: 12, reorderThreshold: 10 },
    ],
  },
  {
    id: "prd_ip13case",
    slug: "iphone-13-pro-max-case",
    name: "iPhone 13 Pro Max Case",
    brand: "Apple",
    category: "accessories",
    tagline: "Silky silicone with MagSafe that just snaps on.",
    description:
      "### Grip you can feel\nSoft-touch silicone exterior with a microfibre lining to protect your iPhone. Built-in magnets align perfectly for MagSafe charging.\n\n- Works with MagSafe wallet\n- Raised camera lip\n- Drop-tested to 1.2 m",
    basePrice: 399_00,
    featured: false,
    tierPricing: true,
    images: gallery("iphone-case", "iPhone 13 Pro Max Case"),
    specs: { Compatibility: "iPhone 13 Pro Max", MagSafe: "Yes", Lining: "Microfibre" },
    materials: "Silicone, microfibre",
    dimensions: "16.3 × 7.9 × 1.1 cm",
    weightGrams: 38,
    soldCount: 318,
    daysOld: 60,
    variants: [
      { sku: "APL-C13PM-SUN", color: "Sunglow", colorHex: "#f6c445", material: "Silicone", stock: 30 },
      { sku: "APL-C13PM-PNK", color: "Pink", colorHex: "#f27aa1", material: "Silicone", stock: 3, reorderThreshold: 8 },
      { sku: "APL-C13PM-MUL", color: "Mulberry", colorHex: "#6b2f45", material: "Silicone", stock: 15 },
    ],
  },
  {
    id: "prd_blackwatch",
    slug: "noir-minimalist-watch",
    name: "Noir Minimalist Watch",
    brand: "Emporium Atelier",
    category: "accessories",
    tagline: "Very demure. Very mindful. An all-black dial for every day.",
    description:
      "### Quietly confident\nA 40 mm brushed-steel case finished in matte black, with a Japanese quartz movement and sapphire-coated crystal.\n\n- 5 ATM water resistance\n- Quick-release strap pins\n- 2-year warranty",
    basePrice: 399_00,
    compareAtPrice: 599_00,
    featured: true,
    tierPricing: true,
    images: gallery("black-watch", "Noir Minimalist Watch"),
    specs: { Movement: "Japanese quartz", Case: "40 mm stainless steel", "Water resistance": "5 ATM", Warranty: "2 years" },
    materials: "Stainless steel, mineral crystal",
    dimensions: "Case 40 mm · Lug 20 mm",
    weightGrams: 82,
    soldCount: 221,
    daysOld: 25,
    variants: [
      { sku: "EMA-NOIR-MESH", material: "Mesh steel", color: "Black", colorHex: "#111111", stock: 18 },
      { sku: "EMA-NOIR-LTHR", material: "Italian leather", color: "Black", colorHex: "#1c1a19", priceOverride: 449_00, stock: 7 },
    ],
  },
  {
    id: "prd_bluejacket",
    slug: "blue-jacket",
    name: "Blue Jacket",
    brand: "Emporium Studio",
    category: "clothes",
    tagline: "New modern jacket. Heavyweight fleece, graphic chest print.",
    description:
      "### Everyday heavyweight\nBrushed 380 gsm cotton fleece hoodie in deep navy with a hand-drawn chest graphic. Relaxed fit with dropped shoulders.\n\n- Kangaroo pocket\n- Double-layer hood\n- Pre-shrunk",
    basePrice: 599_00,
    featured: true,
    tierPricing: true,
    images: gallery("blue-jacket", "Blue Jacket"),
    specs: { Fabric: "380 gsm cotton fleece", Fit: "Relaxed", Care: "Cold wash, tumble low" },
    materials: "80% cotton, 20% polyester",
    dimensions: "See size guide",
    weightGrams: 610,
    soldCount: 377,
    daysOld: 3,
    variants: [
      { sku: "EMS-BJ-NVY-S", color: "Navy", colorHex: "#1f2a5c", size: "S", stock: 6 },
      { sku: "EMS-BJ-NVY-M", color: "Navy", colorHex: "#1f2a5c", size: "M", stock: 14 },
      { sku: "EMS-BJ-NVY-L", color: "Navy", colorHex: "#1f2a5c", size: "L", stock: 11 },
      { sku: "EMS-BJ-NVY-XL", color: "Navy", colorHex: "#1f2a5c", size: "XL", stock: 0 },
    ],
  },
];

/** "Frequently bought together" bundles. Discount applies to one unit of each product per complete set. */
export const BUNDLES: readonly (BundleRule & { title: string })[] = [
  { id: "bundle_iphone_case", title: "iPhone 15 Pro + Case", productIds: ["prd_iphone15pro", "prd_ip13case"], pct: 5 },
  { id: "bundle_audio_case", title: "AirPods + Case", productIds: ["prd_airpods2", "prd_ip13case"], pct: 5 },
  { id: "bundle_fit_watch", title: "Jacket + Watch", productIds: ["prd_bluejacket", "prd_blackwatch"], pct: 15 },
  { id: "bundle_cozy", title: "Plushie + Jacket", productIds: ["prd_catplush", "prd_bluejacket"], pct: 10 },
];

export const CATEGORY_META: Record<Category, { label: string; blurb: string }> = {
  gadgets: { label: "Gadgets", blurb: "Cutting-edge tech, just in! Discover the latest gadgets." },
  furniture: { label: "Furniture", blurb: "Transform your space with stylish, statement furniture." },
  accessories: { label: "Accessories", blurb: "Elevate your look with must-have accessories." },
  clothes: { label: "Clothes", blurb: "Step into style—your wardrobe's next favorite is here." },
};
