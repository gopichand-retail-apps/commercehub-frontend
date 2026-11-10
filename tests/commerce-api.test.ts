import { CommerceApiError, cartItemRequestSchema, commerceApi } from "@/lib/commerce-api";
import { products, quote, receipt, syntheticSession } from "./test-utils";

type JsonResponse = {
  ok: boolean;
  status: number;
  json: jest.Mock<Promise<unknown>>;
};

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

function jsonResponse(payload: unknown, status = 200): JsonResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  };
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

describe("CommerceHub API client", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    fetchMock.mockReset();
    jest.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("request-id-1234");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });

  test("validates product and role responses and applies safe request defaults", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ products: [products[0]] }));
    await expect(commerceApi.products()).resolves.toEqual({ products: [products[0]] });
    expect(lastRequest().url).toBe("/api/v1/products");
    expect(lastRequest().init.credentials).toBe("same-origin");
    expect(lastRequest().headers.get("X-Request-ID")).toBe("request-id-1234");

    fetchMock.mockResolvedValueOnce(jsonResponse({ roles: ["CUSTOMER", "MERCHANT"] }));
    await expect(commerceApi.syntheticRoles()).resolves.toEqual({ roles: ["CUSTOMER", "MERCHANT"] });
    expect(lastRequest().init.cache).toBe("no-store");

    fetchMock.mockResolvedValueOnce(jsonResponse({ products: [{ ...products[0], priceMinor: -1 }] }));
    await expect(commerceApi.products()).rejects.toMatchObject({
      status: 502,
      code: "INVALID_RESPONSE",
    });
  });

  test("creates and validates synthetic sessions and sends bearer credentials", async () => {
    const session = syntheticSession();
    fetchMock.mockResolvedValueOnce(jsonResponse({ session }));
    await expect(commerceApi.createSyntheticSession("CUSTOMER")).resolves.toEqual(session);
    expect(lastRequest().init.method).toBe("POST");
    expect(lastRequest().headers.get("Content-Type")).toBe("application/json");
    expect(lastRequest().init.body).toBe(JSON.stringify({ role: "CUSTOMER" }));
    expect(lastRequest().init.cache).toBe("no-store");

    fetchMock.mockResolvedValueOnce(jsonResponse({ session: { ...session, token: "invalid" } }));
    await expect(commerceApi.createSyntheticSession("CUSTOMER")).rejects.toMatchObject({
      status: 502,
      code: "INVALID_RESPONSE",
    });

    const currentSession = { id: session.id, role: session.role, expiresAt: session.expiresAt };
    fetchMock.mockResolvedValueOnce(jsonResponse({ session: currentSession }));
    await expect(commerceApi.currentSyntheticSession(session.token)).resolves.toEqual(currentSession);
    expect(lastRequest().headers.get("Authorization")).toBe(`Bearer ${session.token}`);

    fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 204));
    await expect(commerceApi.revokeSyntheticSession(session.token)).resolves.toBeUndefined();
    expect(lastRequest().init.method).toBe("DELETE");
    expect(lastRequest().headers.get("Authorization")).toBe(`Bearer ${session.token}`);
  });

  test("sends order headers and validates quotes, creates, and encoded lookups", async () => {
    const request = { items: [{ productId: products[0].id, quantity: 1 }] };
    fetchMock.mockResolvedValueOnce(jsonResponse({ quote }));
    await expect(commerceApi.quote(request)).resolves.toEqual({ quote });
    expect(lastRequest().headers.get("Content-Type")).toBe("application/json");

    fetchMock.mockResolvedValueOnce(jsonResponse({ order: receipt, duplicate: false }, 201));
    await expect(commerceApi.createOrder(request, "checkout-123", "B".repeat(43), "A".repeat(43))).resolves.toEqual({
      order: receipt,
      duplicate: false,
    });
    expect(lastRequest().headers.get("Idempotency-Key")).toBe("checkout-123");
    expect(lastRequest().headers.get("X-Order-Access-Key")).toBe("B".repeat(43));
    expect(lastRequest().headers.get("Authorization")).toBe(`Bearer ${"A".repeat(43)}`);
    expect(lastRequest().init.cache).toBe("no-store");

    fetchMock.mockResolvedValueOnce(jsonResponse({ order: receipt, duplicate: true }));
    await expect(commerceApi.order("order/id", null, null)).resolves.toEqual({ order: receipt, duplicate: true });
    expect(lastRequest().url).toBe("/api/v1/orders/order%2Fid");
    expect(lastRequest().headers.has("Idempotency-Key")).toBe(false);
  });

  test("maps server errors and uses safe errors when the payload is malformed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "STOCK_CHANGED", message: "Stock changed", requestId: null }, 409),
    );
    await expect(commerceApi.products()).rejects.toMatchObject({
      name: "CommerceApiError",
      status: 409,
      code: "STOCK_CHANGED",
      message: "Stock changed",
    });

    const invalidJson = jsonResponse({}, 502);
    invalidJson.json.mockRejectedValueOnce(new Error("not JSON"));
    fetchMock.mockResolvedValueOnce(invalidJson);
    await expect(commerceApi.products()).rejects.toMatchObject({
      status: 502,
      code: "REQUEST_FAILED",
      message: "The request could not be completed",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 4, message: null }, 500));
    await expect(commerceApi.products()).rejects.toMatchObject({
      status: 500,
      code: "REQUEST_FAILED",
      message: "The request could not be completed",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ products: "not-an-array" }));
    await expect(commerceApi.products()).rejects.toBeInstanceOf(CommerceApiError);
  });

  test("maps void-request errors and lets network failures propagate", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: "SESSION_INVALID", message: "Session expired" }, 401));
    await expect(commerceApi.revokeSyntheticSession("A".repeat(43))).rejects.toMatchObject({
      status: 401,
      code: "SESSION_INVALID",
      message: "Session expired",
    });

    const badBody = jsonResponse({}, 500);
    badBody.json.mockRejectedValueOnce(new Error("not JSON"));
    fetchMock.mockResolvedValueOnce(badBody);
    await expect(commerceApi.revokeSyntheticSession("A".repeat(43))).rejects.toMatchObject({
      status: 500,
      code: "REQUEST_FAILED",
      message: "The request could not be completed",
    });

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(commerceApi.products()).rejects.toThrow("offline");
  });

  test("enforces the public cart item request schema", () => {
    expect(cartItemRequestSchema.safeParse({ productId: products[0].id, quantity: 1 }).success).toBe(true);
    expect(cartItemRequestSchema.safeParse({ productId: products[0].id, quantity: 0 }).success).toBe(false);
    expect(cartItemRequestSchema.safeParse({ productId: "not-a-uuid", quantity: 1 }).success).toBe(false);
    expect(cartItemRequestSchema.safeParse({ productId: products[0].id, quantity: 21 }).success).toBe(false);
  });
});
