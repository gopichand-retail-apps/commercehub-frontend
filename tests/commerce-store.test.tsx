import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { CommerceStore } from "@/components/CommerceStore";
import { CommerceApiError, commerceApi, type OrderReceipt } from "@/lib/commerce-api";
import { useSyntheticIdentity } from "@/hooks/useSyntheticIdentity";
import { dataStringAt, dataStringFrom } from "@/lib/content-schema";
import { model, products, quote, receipt, renderWithContent, syntheticSession, translate } from "./test-utils";

jest.mock("@/hooks/useSyntheticIdentity", () => ({
  useSyntheticIdentity: jest.fn(),
}));

const mockUseSyntheticIdentity = jest.mocked(useSyntheticIdentity);

function configureStoreApi() {
  const productList = jest.spyOn(commerceApi, "products").mockResolvedValue({ products });
  const quoteOrder = jest.spyOn(commerceApi, "quote").mockResolvedValue({ quote });
  const createOrder = jest.spyOn(commerceApi, "createOrder").mockResolvedValue({ order: receipt, duplicate: false });
  const findOrder = jest.spyOn(commerceApi, "order").mockResolvedValue({ order: receipt, duplicate: false });

  return {
    createOrder,
    findOrder,
    productList,
    quoteOrder,
  };
}

async function waitForStore() {
  await screen.findByRole("heading", {
    name: dataStringAt(model, "products", products[0].slug, "name"),
  });
  await waitFor(() => expect(screen.getByLabelText(translate("identity.roleLabel"))).toHaveValue("CUSTOMER"));
}

describe("CommerceStore workflow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockUseSyntheticIdentity.mockReset();
    mockUseSyntheticIdentity.mockReturnValue({
      error: null,
      expireSession: jest.fn(),
      isMock: true,
      mode: "mock",
      revocationWarning: false,
      roleCodes: ["CUSTOMER", "MERCHANT", "SUPPORT"],
      selectedRoleCode: "CUSTOMER",
      selectRole: jest.fn(),
      session: syntheticSession(),
      status: "ready",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("checks out, refreshes the receipt, and removes stale session access", async () => {
    const api = configureStoreApi();
    let resolveOrder: (result: { order: OrderReceipt; duplicate: boolean }) => void = () => {};
    api.findOrder.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOrder = resolve;
      }),
    );
    renderWithContent(<CommerceStore />);
    await waitForStore();
    expect(screen.getByRole("main")).toHaveAttribute("data-mode", "mock");

    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await waitFor(() => expect(api.quoteOrder).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: translate("cart.title") })).toHaveAttribute("open"));
    expect(screen.getAllByText("$22.95").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(translate("cart.checkout")) }));
    expect(screen.getByRole("dialog", { name: translate("checkout.title") })).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: translate("checkout.placeOrder") }));

    await screen.findByRole("heading", { name: translate("receipt.title") });
    expect(api.createOrder).toHaveBeenCalledTimes(1);
    expect(api.createOrder.mock.calls[0]?.[0]).toEqual({
      items: [{ productId: products[0].id, quantity: 1 }],
    });
    expect(api.createOrder.mock.calls[0]?.[1]).toMatch(/^[a-f0-9-]{36}$/);
    expect(api.createOrder.mock.calls[0]?.[2]).toBeNull();
    expect(api.createOrder.mock.calls[0]?.[3]).toBe(syntheticSession().token);
    expect(window.localStorage.getItem("commercehub.cart.v1")).toBe("{}");

    fireEvent.click(screen.getByRole("button", { name: translate("header.latestOrder") }));
    await screen.findByText(translate("receipt.loading"));
    await act(async () => {
      resolveOrder({ order: receipt, duplicate: false });
      await Promise.resolve();
    });
    expect(api.findOrder).toHaveBeenCalledWith(receipt.orderId, null, syntheticSession().token);

    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await waitFor(() => expect(api.quoteOrder).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    api.findOrder.mockRejectedValueOnce(new CommerceApiError("Unavailable", 404, "ORDER_NOT_FOUND"));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.latestOrderAction") }));
    await waitFor(() => expect(api.findOrder).toHaveBeenCalledTimes(2));
    await screen.findByText(translate("errors.ORDER_NOT_FOUND"));

    const changedIdentity = {
      error: null,
      expireSession: jest.fn(),
      isMock: true,
      mode: "mock",
      revocationWarning: false,
      roleCodes: ["CUSTOMER", "MERCHANT", "SUPPORT"],
      selectedRoleCode: "CUSTOMER",
      selectRole: jest.fn(),
      session: { ...syntheticSession(), token: "B".repeat(43) },
      status: "ready",
    } satisfies ReturnType<typeof useSyntheticIdentity>;
    mockUseSyntheticIdentity.mockReturnValue(changedIdentity);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "coffee" } });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: translate("header.latestOrder") })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: translate("receipt.title") })).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(translate("identity.roleLabel")), {
      target: { value: "MERCHANT" },
    });
    expect(changedIdentity.selectRole).toHaveBeenCalledWith("MERCHANT");
    expect(screen.queryByRole("button", { name: translate("header.latestOrder") })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: translate("receipt.title") })).not.toBeInTheDocument();
  });

  test("filters and sorts server products, opens quick view, and updates cart quantities", async () => {
    configureStoreApi();
    renderWithContent(<CommerceStore />);
    await waitForStore();

    const cards = () => Array.from(document.querySelectorAll(".product-card h3")).map((heading) => heading.textContent);
    expect(cards()).toHaveLength(products.length);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no matching product" } });
    await waitFor(() => expect(cards()).toHaveLength(0));
    fireEvent.click(screen.getByRole("button", { name: translate("catalog.showAll") }));
    await waitFor(() => expect(cards()).toHaveLength(products.length));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "coffee" } });
    await waitFor(() => expect(cards()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: translate("catalog.clearSearch") }));
    await waitFor(() => expect(cards()).toHaveLength(products.length));

    fireEvent.change(screen.getByLabelText(translate("catalog.sortLabel")), {
      target: { value: "price-low" },
    });
    await waitFor(() => expect(cards()[0]).toBe(products[0].name));
    fireEvent.change(screen.getByLabelText(translate("catalog.sortLabel")), {
      target: { value: "price-high" },
    });
    await waitFor(() => expect(cards()[0]).toBe(products[3].name));
    fireEvent.click(
      screen.getByRole("button", {
        name: dataStringFrom(model, "categoryNames", products[2].category),
      }),
    );
    await waitFor(() => expect(cards()).toEqual([products[2].name]));

    fireEvent.click(
      screen.getByRole("button", {
        name: translate("product.viewDetails", { name: products[2].name }),
      }),
    );
    expect(screen.getByRole("dialog", { name: products[2].name })).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: translate("dialog.addToBag") }));
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    const quantity = () => document.querySelector(".quantity-control [aria-live='polite']")?.textContent;
    expect(quantity()).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: translate("cart.addOne", { name: products[2].name }) }));
    await waitFor(() => expect(quantity()).toBe("2"));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.removeOne", { name: products[2].name }) }));
    await waitFor(() => expect(quantity()).toBe("1"));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.removeOne", { name: products[2].name }) }));
    await screen.findByRole("heading", { name: translate("cart.emptyTitle") });

    fireEvent.click(screen.getByRole("button", { name: translate("catalog.allGoods") }));
    expect(
      screen.getByRole("button", {
        name: translate("product.addToBag", { name: products[3].name }),
      }),
    ).toBeDisabled();
  });

  test("normalizes and clears promo codes while recovering from quote errors", async () => {
    const api = configureStoreApi();
    api.quoteOrder.mockRejectedValue(new CommerceApiError("Unavailable", 400, "PROMO_CODE_INVALID"));
    renderWithContent(<CommerceStore />);
    await waitForStore();
    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await screen.findByText(translate("errors.PROMO_CODE_INVALID"));
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    const promoInput = screen.getByLabelText(translate("cart.promoLabel"));
    const promoForm = promoInput.closest("form");
    expect(promoForm).not.toBeNull();
    const requestsBeforeEmptySubmit = api.quoteOrder.mock.calls.length;
    fireEvent.submit(promoForm as HTMLFormElement);
    expect(api.quoteOrder).toHaveBeenCalledTimes(requestsBeforeEmptySubmit);

    fireEvent.change(promoInput, { target: { value: " hello10 " } });
    fireEvent.click(screen.getByRole("button", { name: translate("cart.applyPromo") }));
    await waitFor(() =>
      expect(screen.getByText(translate("cart.promoApplied", { code: "HELLO10" }))).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(api.quoteOrder).toHaveBeenLastCalledWith(
        { items: [{ productId: products[0].id, quantity: 1 }], promoCode: "HELLO10" },
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: translate("cart.removePromo") }));
    await waitFor(() => expect(screen.queryByText(translate("cart.promoApplied", { code: "HELLO10" }))).toBeNull());
    expect(api.quoteOrder).toHaveBeenLastCalledWith(
      { items: [{ productId: products[0].id, quantity: 1 }] },
      expect.any(AbortSignal),
    );
  });

  test("includes the normalized promo code in a simulated order request", async () => {
    const api = configureStoreApi();
    renderWithContent(<CommerceStore />);
    await waitForStore();
    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await waitFor(() => expect(api.quoteOrder).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    const promoInput = screen.getByLabelText(translate("cart.promoLabel"));
    fireEvent.change(promoInput, { target: { value: " hello10 " } });
    fireEvent.click(screen.getByRole("button", { name: translate("cart.applyPromo") }));
    await waitFor(() =>
      expect(api.quoteOrder).toHaveBeenLastCalledWith(
        { items: [{ productId: products[0].id, quantity: 1 }], promoCode: "HELLO10" },
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(translate("cart.checkout")) }));
    fireEvent.click(screen.getByRole("button", { name: translate("checkout.placeOrder") }));
    await screen.findByRole("heading", { name: translate("receipt.title") });
    expect(api.createOrder.mock.calls[0]?.[0]).toEqual({
      items: [{ productId: products[0].id, quantity: 1 }],
      promoCode: "HELLO10",
    });
  });

  test("reuses an idempotency key for the same retry and refreshes it after cart changes", async () => {
    const api = configureStoreApi();
    api.createOrder
      .mockRejectedValueOnce(new CommerceApiError("Conflict", 409, "IDEMPOTENCY_CONFLICT"))
      .mockRejectedValueOnce(new CommerceApiError("Conflict", 409, "IDEMPOTENCY_CONFLICT"))
      .mockResolvedValueOnce({ order: receipt, duplicate: false });
    renderWithContent(<CommerceStore />);
    await waitForStore();

    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await waitFor(() => expect(api.quoteOrder).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(translate("cart.checkout")) }));
    const placeOrderButton = () => screen.getByRole("button", { name: translate("checkout.placeOrder") });
    fireEvent.click(placeOrderButton());
    await screen.findByText(translate("errors.IDEMPOTENCY_CONFLICT"));
    const firstKey = api.createOrder.mock.calls[0]?.[1];

    fireEvent.click(placeOrderButton());
    await screen.findByText(translate("errors.IDEMPOTENCY_CONFLICT"));
    expect(api.createOrder.mock.calls[1]?.[1]).toBe(firstKey);

    fireEvent.click(screen.getByRole("button", { name: translate("checkout.close") }));
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.addOne", { name: products[0].name }) }));
    await waitFor(() =>
      expect(api.quoteOrder).toHaveBeenLastCalledWith(
        { items: [{ productId: products[0].id, quantity: 2 }] },
        expect.any(AbortSignal),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: new RegExp(translate("cart.checkout")) }));
    fireEvent.click(placeOrderButton());
    await screen.findByRole("heading", { name: translate("receipt.title") });
    expect(api.createOrder.mock.calls[2]?.[1]).not.toBe(firstKey);
  });

  test("shows catalog failure and supports the retry action", async () => {
    const api = configureStoreApi();
    api.productList.mockRejectedValue(new CommerceApiError("Missing", 503, "PRODUCT_NOT_FOUND"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    renderWithContent(<CommerceStore />);
    await screen.findByText(translate("errors.PRODUCT_NOT_FOUND"));
    fireEvent.click(screen.getByRole("button", { name: translate("catalog.tryAgain") }));
    expect(consoleError).toHaveBeenCalled();
  });

  test("does not submit an order when a synthetic session has no bearer token", async () => {
    const api = configureStoreApi();
    mockUseSyntheticIdentity.mockReturnValue({
      error: null,
      expireSession: jest.fn(),
      isMock: true,
      mode: "mock",
      revocationWarning: false,
      roleCodes: ["CUSTOMER"],
      selectedRoleCode: "CUSTOMER",
      selectRole: jest.fn().mockResolvedValue(undefined),
      session: { ...syntheticSession(), token: "" },
      status: "ready",
    });
    renderWithContent(<CommerceStore />);
    await waitForStore();
    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await waitFor(() => expect(api.quoteOrder).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(translate("cart.checkout")) }));
    fireEvent.click(screen.getByRole("button", { name: translate("checkout.placeOrder") }));

    expect(await screen.findByText(translate("errors.requestFailed"))).toBeInTheDocument();
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  test("maps identity errors and marks live mode on the storefront", async () => {
    configureStoreApi();
    mockUseSyntheticIdentity.mockReturnValue({
      error: new CommerceApiError("Expired", 401, "SESSION_INVALID"),
      expireSession: jest.fn(),
      isMock: false,
      mode: "server",
      revocationWarning: false,
      roleCodes: [],
      selectedRoleCode: "",
      selectRole: jest.fn(),
      session: null,
      status: "error",
    });
    renderWithContent(<CommerceStore />);

    expect(await screen.findByRole("main")).toHaveAttribute("data-mode", "live");
    expect(screen.getByRole("alert")).toHaveTextContent(translate("errors.SESSION_INVALID"));
  });

  test("does not request a quote for a malformed stored product identifier", async () => {
    const api = configureStoreApi();
    const malformedProduct = { ...products[0], id: "not-a-uuid" };
    api.productList.mockResolvedValue({ products: [malformedProduct] });
    window.localStorage.setItem("commercehub.cart.v1", JSON.stringify({ "not-a-uuid": 1 }));

    renderWithContent(<CommerceStore />);
    await waitForStore();

    expect(api.quoteOrder).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: translate("header.bagCount", { count: "1" }) })).toBeInTheDocument();
  });

  test("ignores product and quote failures after their requests are aborted", async () => {
    let rejectProducts: (error: unknown) => void = () => {};
    const api = configureStoreApi();
    api.productList.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectProducts = reject;
      }),
    );
    const productView = renderWithContent(<CommerceStore />);
    productView.unmount();
    await act(async () => {
      rejectProducts(new Error("aborted"));
      await Promise.resolve();
      await Promise.resolve();
    });

    api.productList.mockResolvedValue({ products });
    let rejectQuote: (error: unknown) => void = () => {};
    api.quoteOrder.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectQuote = reject;
      }),
    );
    const quoteView = renderWithContent(<CommerceStore />);
    await waitForStore();
    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: products[0].name }) }));
    await waitFor(() => expect(api.quoteOrder).toHaveBeenCalled());
    quoteView.unmount();
    await act(async () => {
      rejectQuote(new Error("aborted"));
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
