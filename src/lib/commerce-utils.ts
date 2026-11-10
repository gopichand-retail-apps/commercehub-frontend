import { z } from "zod";

const savedCartSchema = z.record(z.string(), z.number().int().min(1).max(20));
const CART_STORAGE_KEY = "commercehub.cart.v1";
const CART_CHANGED_EVENT = "commercehub:cart-changed";
const EMPTY_CART_SNAPSHOT = "{}";

export function formatMoney(amountMinor: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountMinor / 100);
}

export function subscribeToCart(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", listener);
  window.addEventListener(CART_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CART_CHANGED_EVENT, listener);
  };
}

export function getSavedCartSnapshot(): string {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY) ?? EMPTY_CART_SNAPSHOT;
  } catch {
    return EMPTY_CART_SNAPSHOT;
  }
}

export function getEmptyCartSnapshot(): string {
  return EMPTY_CART_SNAPSHOT;
}

export function parseSavedCart(snapshot: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    const result = savedCartSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function writeSavedCart(cart: Record<string, number>): boolean {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}
