import type { ProductPreset } from "./product-editor";

/** Realistic quick-fill starting points for the "New product" form (all start as drafts). */
export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    label: "Apparel drop · Weekend Overshirt",
    matrix: { colors: "Navy #1f2a5c, Olive #4b5320", sizes: "S, M, L, XL", materials: "", prefix: "EMS-OVR" },
    values: {
      name: "Weekend Overshirt",
      slug: "weekend-overshirt",
      brand: "Emporium Studio",
      category: "clothes",
      tagline: "Brushed cotton twill that layers over tees from Baguio mornings to office aircon.",
      description:
        "### Made for layering\nA relaxed overshirt in **brushed cotton twill** with a soft hand and enough structure to wear as a light jacket.\n\n- Two chest pockets with button flaps\n- Corozo buttons, double-stitched seams\n- Machine wash cold, line dry\n\nSee our [size guide](/support) for measurements.",
      basePrice: "1490",
      compareAtPrice: "1790",
      status: "draft",
      featured: false,
      tierPricing: true,
      materials: "100% cotton twill, 280 gsm",
      dimensions: "Relaxed fit · model is 180 cm and wears M",
      images: [
        { src: "/images/products/blue-jacket-1.webp", alt: "Navy overshirt laid flat" },
        { src: "/images/products/blue-jacket-2.webp", alt: "Model wearing the navy overshirt open over a tee" },
      ],
      variants: [
        { sku: "EMS-OVR-NVY-S", color: "Navy", colorHex: "#1f2a5c", size: "S", material: "", priceOverride: "", stock: 12, reorderThreshold: 4 },
        { sku: "EMS-OVR-NVY-M", color: "Navy", colorHex: "#1f2a5c", size: "M", material: "", priceOverride: "", stock: 18, reorderThreshold: 6 },
        { sku: "EMS-OVR-NVY-L", color: "Navy", colorHex: "#1f2a5c", size: "L", material: "", priceOverride: "", stock: 14, reorderThreshold: 5 },
        { sku: "EMS-OVR-NVY-XL", color: "Navy", colorHex: "#1f2a5c", size: "XL", material: "", priceOverride: "", stock: 6, reorderThreshold: 3 },
      ],
    },
  },
  {
    label: "Gadget accessory · MagSafe Wallet",
    matrix: { colors: "Midnight #1d2433, Saddle #8b5a2b, Sunglow #f6c445", sizes: "", materials: "", prefix: "EMA-WLT" },
    values: {
      name: "MagSafe Leather Wallet",
      slug: "magsafe-leather-wallet",
      brand: "Emporium Accessories",
      category: "accessories",
      tagline: "Snaps to the back of your iPhone and holds three cards plus folded cash.",
      description:
        "### Snap, tap, go\nFull-grain leather with a **strong N52 magnet array** that stays put through jeepney rides.\n\n- Holds 3 cards and folded bills\n- Shields cards from the MagSafe charger\n- Develops a patina over time",
      basePrice: "1290",
      compareAtPrice: "",
      status: "draft",
      featured: false,
      tierPricing: true,
      materials: "Full-grain leather, microfibre lining",
      dimensions: "96 × 63 × 6 mm · 28 g",
      images: [
        { src: "/images/products/iphone-case-1.webp", alt: "Leather wallet attached to the back of an iPhone" },
        { src: "/images/products/iphone-case-3.webp", alt: "Wallet colourways side by side" },
      ],
      variants: [
        { sku: "EMA-WLT-MDNG", color: "Midnight", colorHex: "#1d2433", size: "", material: "", priceOverride: "", stock: 25, reorderThreshold: 6 },
        { sku: "EMA-WLT-SDDL", color: "Saddle", colorHex: "#8b5a2b", size: "", material: "", priceOverride: "", stock: 20, reorderThreshold: 6 },
        { sku: "EMA-WLT-SNG", color: "Sunglow", colorHex: "#f6c445", size: "", material: "", priceOverride: "", stock: 10, reorderThreshold: 4 },
      ],
    },
  },
  {
    label: "Home · Cat Cushion XL",
    matrix: { colors: "", sizes: "Large (45 cm), XL (60 cm)", materials: "", prefix: "EMH-CSH" },
    values: {
      name: "Cat Cushion XL",
      slug: "cat-cushion-xl",
      brand: "Emporium Home",
      category: "furniture",
      tagline: "The plushie everyone loves, scaled up into a floor cushion for movie nights.",
      description: "### Sink right in\nUltra-soft minky shell over **recycled polyfill** that springs back after every nap.\n\n- Removable, washable cover\n- Embroidered face, no small parts",
      basePrice: "899",
      compareAtPrice: "",
      status: "draft",
      featured: false,
      tierPricing: false,
      materials: "Minky polyester shell, recycled polyfill",
      dimensions: "45 cm or 60 cm diameter",
      images: [{ src: "/images/products/cat-plushie-1.webp", alt: "Grey cat cushion on a sofa" }],
      variants: [
        { sku: "EMH-CSH-L45", color: "", colorHex: "", size: "Large (45 cm)", material: "", priceOverride: "", stock: 15, reorderThreshold: 5 },
        { sku: "EMH-CSH-XL60", color: "", colorHex: "", size: "XL (60 cm)", material: "", priceOverride: "1199", stock: 8, reorderThreshold: 3 },
      ],
    },
  },
];
