import { z } from "zod";

const productSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  subtitle: z.string(),
  description: z.string(),
  category: z.string(),
  priceMinor: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  imageUrl: z.string(),
  featured: z.boolean(),
});

const productListSchema = z.object({ products: z.array(productSchema) });

const quoteLineSchema = z.object({
  productId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
});

const quoteSchema = z.object({
  lines: z.array(quoteLineSchema),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  taxBasisPoints: z.number().int().min(0).max(10_000),
  promoCode: z.string().nullable(),
  currency: z.literal("USD"),
});

const orderLineSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string(),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
});

const orderReceiptSchema = z.object({
  orderId: z.string().uuid(),
  status: z.string(),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  taxBasisPoints: z.number().int().min(0).max(10_000),
  promoCode: z.string().nullable(),
  currency: z.literal("USD"),
  items: z.array(orderLineSchema),
  createdAt: z.string(),
});

const orderResponseSchema = z.object({
  order: orderReceiptSchema,
  duplicate: z.boolean(),
});

const roleListSchema = z.object({
  roles: z.array(z.string().regex(/^[A-Z][A-Z_]{0,31}$/)).min(1),
});

const syntheticSessionSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    role: z.string().regex(/^[A-Z][A-Z_]{0,31}$/),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: z.string().datetime(),
  }),
});

const currentSyntheticSessionSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    role: z.string().regex(/^[A-Z][A-Z_]{0,31}$/),
    expiresAt: z.string().datetime(),
  }),
});

const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().nullable().optional(),
});

export const cartItemRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export type Product = z.infer<typeof productSchema>;
export type CartItemRequest = z.infer<typeof cartItemRequestSchema>;
export type OrderQuote = z.infer<typeof quoteSchema>;
export type OrderReceipt = z.infer<typeof orderReceiptSchema>;
export type SyntheticSession = z.infer<typeof syntheticSessionSchema>["session"];
export type CurrentSyntheticSession = z.infer<typeof currentSyntheticSessionSchema>["session"];
export type OrderRequest = {
  items: CartItemRequest[];
  promoCode?: string;
};

export class CommerceApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "CommerceApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T extends z.ZodType>(path: string, schema: T, init: RequestInit = {}): Promise<z.output<T>> {
  const headers = new Headers(init.headers);
  headers.set("X-Request-ID", crypto.randomUUID());
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);
    const details = parsedError.success ? parsedError.data : null;
    throw new CommerceApiError(
      details?.message ?? "The request could not be completed",
      response.status,
      details?.code ?? "REQUEST_FAILED",
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new CommerceApiError("The server returned an invalid response", 502, "INVALID_RESPONSE");
  }

  return parsed.data;
}

export const commerceApi = {
  products: (signal?: AbortSignal) => request("/api/v1/products", productListSchema, { signal }),
  syntheticRoles: (signal?: AbortSignal) =>
    request("/api/v1/sessions/roles", roleListSchema, { cache: "no-store", signal }),
  createSyntheticSession: async (role: string, signal?: AbortSignal) => {
    const response = await request("/api/v1/sessions", syntheticSessionSchema, {
      method: "POST",
      body: JSON.stringify({ role }),
      cache: "no-store",
      signal,
    });
    return response.session;
  },
  currentSyntheticSession: async (token: string, signal?: AbortSignal) => {
    const response = await request("/api/v1/sessions/current", currentSyntheticSessionSchema, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal,
    });
    return response.session;
  },
  revokeSyntheticSession: (token: string, signal?: AbortSignal) =>
    requestVoid("/api/v1/sessions/current", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal,
    }),
  quote: (body: OrderRequest, signal?: AbortSignal) =>
    request("/api/v1/orders/quote", z.object({ quote: quoteSchema }), {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  createOrder: (
    body: OrderRequest,
    idempotencyKey: string,
    accessKey: string | null,
    sessionToken: string | null,
    signal?: AbortSignal,
  ) =>
    request("/api/v1/orders", orderResponseSchema, {
      method: "POST",
      headers: orderHeaders(idempotencyKey, accessKey, sessionToken),
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    }),
  order: (orderId: string, accessKey: string | null, sessionToken: string | null, signal?: AbortSignal) =>
    request(`/api/v1/orders/${encodeURIComponent(orderId)}`, orderResponseSchema, {
      headers: orderHeaders(null, accessKey, sessionToken),
      cache: "no-store",
      signal,
    }),
};

function orderHeaders(
  idempotencyKey: string | null,
  accessKey: string | null,
  sessionToken: string | null,
): HeadersInit {
  return {
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...(accessKey ? { "X-Order-Access-Key": accessKey } : {}),
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

async function requestVoid(path: string, init: RequestInit = {}): Promise<void> {
  const headers = new Headers(init.headers);
  headers.set("X-Request-ID", crypto.randomUUID());
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (response.ok) return;

  const payload: unknown = await response.json().catch(() => undefined);
  const parsedError = apiErrorSchema.safeParse(payload);
  throw new CommerceApiError(
    parsedError.success ? parsedError.data.message : "The request could not be completed",
    response.status,
    parsedError.success ? parsedError.data.code : "REQUEST_FAILED",
  );
}
