"use client";

import { useDeferredValue, useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { CartPanel, type CartLine } from "@/components/CartPanel";
import { CatalogSection, type CatalogState } from "@/components/CatalogSection";
import { CheckoutDialog, ProductDialog, ReceiptDialog } from "@/components/CommerceDialogs";
import { SyntheticIdentityPanel } from "@/components/SyntheticIdentityPanel";
import {
  DemoPolicy,
  DemoRibbon,
  HeroBand,
  ShippingRibbon,
  SiteHeader,
  StoreApproach,
  StoreFooter,
} from "@/components/StoreSections";
import { useSyntheticIdentity } from "@/hooks/useSyntheticIdentity";
import {
  CommerceApiError,
  cartItemRequestSchema,
  commerceApi,
  type CartItemRequest,
  type OrderReceipt,
  type OrderRequest,
  type OrderQuote,
  type Product,
} from "@/lib/commerce-api";
import {
  getEmptyCartSnapshot,
  getSavedCartSnapshot,
  parseSavedCart,
  subscribeToCart,
  writeSavedCart,
} from "@/lib/commerce-utils";
import { useContent } from "@/lib/content-context";
import {
  dataString,
  dataStringArray,
  dataStringAt,
  dataStringFrom,
  errorMessage as resolveErrorMessage,
} from "@/lib/content-schema";

type QuoteState = "idle" | "loading" | "ready" | "error";
type CheckoutAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};
type OrderAccess = { sessionToken: string };
type QuoteResult =
  { fingerprint: string; state: "ready"; quote: OrderQuote } | { fingerprint: string; state: "error"; message: string };

export function CommerceStore() {
  const { model, t } = useContent();
  const identity = useSyntheticIdentity(model);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("featured");
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDraft, setPromoDraft] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutAttempt, setCheckoutAttempt] = useState<CheckoutAttempt | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [latestOrderAccess, setLatestOrderAccess] = useState<OrderAccess | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const cartSnapshot = useSyncExternalStore(subscribeToCart, getSavedCartSnapshot, getEmptyCartSnapshot);
  const cart = parseSavedCart(cartSnapshot);
  const checkoutRoleCode = dataString(model, "identity.checkoutRoleCode");
  const canCheckout =
    identity.status === "ready" && identity.selectedRoleCode === checkoutRoleCode && Boolean(identity.session);
  const orderAccessMatchesCurrentSession =
    !latestOrderAccess?.sessionToken || latestOrderAccess.sessionToken === identity.session?.token;
  const currentReceipt = orderAccessMatchesCurrentSession ? receipt : null;
  const currentOrderAccess = orderAccessMatchesCurrentSession ? latestOrderAccess : null;
  const hasLatestOrder = Boolean(currentReceipt && currentOrderAccess?.sessionToken);
  const identityError = identity.error ? resolveErrorMessage(model, t, identity.error) : "";

  useEffect(() => {
    const controller = new AbortController();
    commerceApi
      .products(controller.signal)
      .then(({ products: loadedProducts }) => {
        setProducts(loadedProducts);
        setCatalogState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(resolveErrorMessage(model, t, error));
        setCatalogState("error");
      });

    return () => controller.abort();
  }, [model, t]);

  const cartLines: CartLine[] = Object.entries(cart).flatMap(([productId, quantity]) => {
    const product = products.find((candidate) => candidate.id === productId);
    return product ? [{ product, quantity }] : [];
  });
  const cartRequestItems: CartItemRequest[] = cartLines.map(({ product, quantity }) => ({
    productId: product.id,
    quantity,
  }));
  const cartRequestJson = JSON.stringify(cartRequestItems);
  const cartFingerprint = `${cartRequestJson}|${promoCode ?? ""}`;
  const activeQuoteResult = quoteResult?.fingerprint === cartFingerprint ? quoteResult : null;
  const quoteState: QuoteState = cartRequestItems.length === 0 ? "idle" : (activeQuoteResult?.state ?? "loading");
  const quote = activeQuoteResult?.state === "ready" ? activeQuoteResult.quote : null;
  const quoteError = activeQuoteResult?.state === "error" ? activeQuoteResult.message : "";
  const categoryIds = dataStringArray(model, "categoryOrder");
  const categoryOptions = [
    { id: "ALL", label: t("catalog.allGoods") },
    ...categoryIds.map((id) => ({ id, label: dataStringFrom(model, "categoryNames", id) })),
  ];
  const visibleProducts = products
    .filter((product) => {
      const localizedValues = [
        dataStringAt(model, "products", product.slug, "name"),
        dataStringAt(model, "products", product.slug, "subtitle"),
        dataStringAt(model, "products", product.slug, "description"),
        dataStringFrom(model, "categoryNames", product.category),
      ];
      const matchesText = localizedValues.some((value) => value.toLowerCase().includes(deferredQuery));
      const matchesCategory = activeCategory === "ALL" || product.category === activeCategory;
      return matchesText && matchesCategory;
    })
    .sort((left, right) => {
      if (sortOrder === "price-low") return left.priceMinor - right.priceMinor;
      if (sortOrder === "price-high") return right.priceMinor - left.priceMinor;
      if (left.featured !== right.featured) return Number(right.featured) - Number(left.featured);
      return dataStringAt(model, "products", left.slug, "name").localeCompare(
        dataStringAt(model, "products", right.slug, "name"),
      );
    });
  const itemCount = cartLines.reduce((total, line) => total + line.quantity, 0);

  useEffect(() => {
    if (cartRequestJson === "[]") return;
    const controller = new AbortController();
    const payload: unknown = JSON.parse(cartRequestJson);
    const parsedItems = z.array(cartItemRequestSchema).safeParse(payload);
    if (!parsedItems.success) return () => controller.abort();

    const requestBody: OrderRequest = {
      items: parsedItems.data,
      ...(promoCode ? { promoCode } : {}),
    };
    commerceApi
      .quote(requestBody, controller.signal)
      .then(({ quote: serverQuote }) => {
        if (controller.signal.aborted) return;
        setQuoteResult({ fingerprint: cartFingerprint, state: "ready", quote: serverQuote });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setQuoteResult({
          fingerprint: cartFingerprint,
          state: "error",
          message: resolveErrorMessage(model, t, error),
        });
      });
    return () => controller.abort();
  }, [cartFingerprint, cartRequestJson, model, promoCode, t]);

  function addToCart(product: Product) {
    if (product.stockQuantity < 1) return;
    writeSavedCart({
      ...cart,
      [product.id]: Math.min((cart[product.id] ?? 0) + 1, product.stockQuantity),
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    const product = products.find((candidate) => candidate.id === productId);
    const nextCart = { ...cart };
    if (!product || quantity <= 0) {
      delete nextCart[productId];
    } else {
      nextCart[productId] = Math.min(quantity, product.stockQuantity);
    }
    writeSavedCart(nextCart);
    setCheckoutError("");
  }

  function applyPromo() {
    const normalized = promoDraft.trim().toUpperCase();
    if (!normalized) return;
    setPromoDraft(normalized);
    setPromoCode(normalized);
    setCheckoutError("");
  }

  function clearPromo() {
    setPromoCode(null);
    setPromoDraft("");
    setCheckoutError("");
  }

  function handleSessionExpired() {
    identity.expireSession();
    setLatestOrderAccess(null);
    setReceipt(null);
    setReceiptOpen(false);
    setReceiptError("");
  }

  async function placeOrder() {
    if (!canCheckout || !quote || quoteState !== "ready" || cartRequestItems.length === 0) return;
    const attempt =
      checkoutAttempt?.fingerprint === cartFingerprint
        ? checkoutAttempt
        : {
            fingerprint: cartFingerprint,
            idempotencyKey: crypto.randomUUID(),
          };
    setCheckoutAttempt(attempt);
    setCheckoutPending(true);
    setCheckoutError("");

    const requestBody: OrderRequest = {
      items: cartRequestItems,
      ...(promoCode ? { promoCode } : {}),
    };

    try {
      const sessionToken = identity.session?.token ?? null;
      if (!sessionToken) {
        throw new Error("SYNTHETIC_SESSION_REQUIRED");
      }
      const result = await commerceApi.createOrder(requestBody, attempt.idempotencyKey, null, sessionToken);
      setReceipt(result.order);
      setLatestOrderAccess({ sessionToken });
      writeSavedCart({});
      setPromoCode(null);
      setPromoDraft("");
      setCheckoutAttempt(null);
      setCheckoutOpen(false);
      setReceiptError("");
      setReceiptOpen(true);
    } catch (error) {
      if (isSessionExpired(error)) {
        handleSessionExpired();
        setCheckoutOpen(false);
        setCheckoutError("");
      } else {
        setCheckoutError(resolveErrorMessage(model, t, error));
      }
    } finally {
      setCheckoutPending(false);
    }
  }

  async function refreshLatestOrder() {
    if (!currentReceipt || !currentOrderAccess) return;
    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptError("");
    try {
      const result = await commerceApi.order(currentReceipt.orderId, null, currentOrderAccess.sessionToken);
      setReceipt(result.order);
    } catch (error) {
      if (isSessionExpired(error)) {
        handleSessionExpired();
      } else {
        setReceiptError(resolveErrorMessage(model, t, error));
      }
    } finally {
      setReceiptLoading(false);
    }
  }

  function changeIdentityRole(role: string) {
    setCheckoutError("");
    setReceiptError("");
    if (role !== identity.selectedRoleCode) {
      setLatestOrderAccess(null);
      setReceipt(null);
      setReceiptOpen(false);
    }
    void identity.selectRole(role);
  }

  return (
    <main className="store-page" data-mode={identity.isMock ? "mock" : "live"}>
      <DemoRibbon />
      <SyntheticIdentityPanel
        mode={identity.mode}
        roleCodes={identity.roleCodes}
        selectedRoleCode={identity.selectedRoleCode}
        checkoutRoleCode={checkoutRoleCode}
        status={identity.status}
        error={identityError}
        revocationWarning={identity.revocationWarning}
        onSelectRole={changeIdentityRole}
      />
      <SiteHeader
        itemCount={itemCount}
        hasLatestOrder={hasLatestOrder}
        onOpenBag={() => setMobileCartOpen(true)}
        onViewLatestOrder={() => void refreshLatestOrder()}
      />
      <HeroBand />
      <ShippingRibbon />
      <CatalogSection
        visibleProducts={visibleProducts}
        categories={categoryOptions}
        activeCategory={activeCategory}
        query={query}
        sortOrder={sortOrder}
        catalogState={catalogState}
        catalogError={catalogError}
        quoteUpdating={quoteState === "loading" && itemCount > 0}
        onCategoryChange={setActiveCategory}
        onQueryChange={setQuery}
        onClearQuery={() => setQuery("")}
        onSortChange={setSortOrder}
        onRetry={() => window.location.reload()}
        onResetFilters={() => {
          setQuery("");
          setActiveCategory("ALL");
        }}
        onAdd={addToCart}
        onView={setSelectedProduct}
      />
      <StoreApproach />
      <DemoPolicy />
      <StoreFooter />

      <CartPanel
        lines={cartLines}
        quote={quote}
        quoteState={quoteState}
        quoteError={quoteError}
        promoCode={promoCode ?? ""}
        promoDraft={promoDraft}
        isCheckoutPending={checkoutPending}
        latestOrder={hasLatestOrder}
        canCheckout={canCheckout}
        mobileOpen={mobileCartOpen}
        onQuantityChange={changeQuantity}
        onPromoDraftChange={setPromoDraft}
        onApplyPromo={applyPromo}
        onClearPromo={clearPromo}
        onCheckout={() => {
          setCheckoutError("");
          setMobileCartOpen(false);
          setCheckoutOpen(true);
        }}
        onViewOrder={() => void refreshLatestOrder()}
        onCloseMobile={() => setMobileCartOpen(false)}
      />

      <ProductDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={(product) => {
          addToCart(product);
          setSelectedProduct(null);
        }}
      />
      <CheckoutDialog
        open={checkoutOpen}
        quote={quote}
        error={checkoutError}
        pending={checkoutPending}
        onClose={() => setCheckoutOpen(false)}
        onPlaceOrder={() => void placeOrder()}
      />
      <ReceiptDialog
        open={receiptOpen && Boolean(currentReceipt)}
        receipt={currentReceipt}
        loading={receiptLoading}
        error={receiptError}
        onClose={() => setReceiptOpen(false)}
      />
    </main>
  );
}

function isSessionExpired(error: unknown): boolean {
  return error instanceof CommerceApiError && error.status === 401;
}
