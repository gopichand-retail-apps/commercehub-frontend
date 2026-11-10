import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import storefrontModel from "../public/commercehub-model.json";
import { ContentContext, type ContentContextValue } from "@/lib/content-context";
import { contentModelSchema, type ContentModel, type MessageValues, type Translate } from "@/lib/content-schema";
import type { OrderQuote, OrderReceipt, Product, SyntheticSession } from "@/lib/commerce-api";

export const model = contentModelSchema.parse(storefrontModel);

export const translate: Translate = (key, values = {}) => {
  const template = model.messages[key];
  if (template === undefined) throw new Error(`CONTENT_KEY_MISSING:${key}`);
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, name: string) => {
    const replacement = values[name];
    if (replacement === undefined) throw new Error(`CONTENT_VALUE_MISSING:${name}`);
    return String(replacement);
  });
};

const productCopy = model.data.products as Record<
  string,
  { name: string; subtitle: string; description: string; category: string }
>;
const productIds = Object.fromEntries(
  Object.entries(model.data.productSlugsById as Record<string, string>).map(([id, slug]) => [slug, id]),
);

function productFixture(slug: string, priceMinor: number, stockQuantity: number, featured: boolean): Product {
  const copy = productCopy[slug];
  return {
    id: productIds[slug],
    slug,
    name: copy.name,
    subtitle: copy.subtitle,
    description: copy.description,
    category: copy.category,
    priceMinor,
    stockQuantity,
    imageUrl: `/products/${slug}.jpg`,
    featured,
  };
}

export const products: Product[] = [
  productFixture("daybreak-coffee", 1800, 24, true),
  productFixture("dawn-stoneware-mug", 2800, 13, true),
  productFixture("everyday-daypack", 2400, 16, true),
  productFixture("reading-lamp", 6800, 0, false),
];

export const quote: OrderQuote = {
  lines: [
    {
      productId: products[0].id,
      slug: products[0].slug,
      name: products[0].name,
      imageUrl: products[0].imageUrl,
      quantity: 1,
      unitPriceMinor: products[0].priceMinor,
      subtotalMinor: products[0].priceMinor,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: products[0].priceMinor,
    },
  ],
  subtotalMinor: products[0].priceMinor,
  discountMinor: 0,
  shippingMinor: 495,
  taxMinor: 0,
  totalMinor: 2295,
  taxBasisPoints: 0,
  promoCode: null,
  currency: "USD",
};

export const receipt: OrderReceipt = {
  orderId: "40a43d73-13de-4e15-9483-46f2a0a9ef71",
  status: "CONFIRMED",
  subtotalMinor: quote.subtotalMinor,
  discountMinor: quote.discountMinor,
  shippingMinor: quote.shippingMinor,
  taxMinor: quote.taxMinor,
  totalMinor: quote.totalMinor,
  taxBasisPoints: quote.taxBasisPoints,
  promoCode: quote.promoCode,
  currency: quote.currency,
  items: quote.lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    imageUrl: line.imageUrl,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    discountMinor: line.discountMinor,
    taxMinor: line.taxMinor,
    totalMinor: line.totalMinor,
  })),
  createdAt: "2026-11-01T12:00:00.000Z",
};

export function syntheticSession(role = "CUSTOMER"): SyntheticSession {
  return {
    id: "80a6da1d-80e9-4ad0-9b05-a090ff3c4c57",
    role,
    token: "A".repeat(43),
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
}

export function contentValue(modelValue: ContentModel = model): ContentContextValue {
  const t: Translate = (key, values: MessageValues = {}) => {
    const template = modelValue.messages[key];
    if (template === undefined) throw new Error(`CONTENT_KEY_MISSING:${key}`);
    return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, name: string) => {
      const replacement = values[name];
      if (replacement === undefined) throw new Error(`CONTENT_VALUE_MISSING:${name}`);
      return String(replacement);
    });
  };
  return { model: modelValue, t };
}

export function renderWithContent(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <ContentContext.Provider value={contentValue()}>{children}</ContentContext.Provider>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
