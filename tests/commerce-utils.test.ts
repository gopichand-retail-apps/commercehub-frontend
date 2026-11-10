import {
  formatMoney,
  getEmptyCartSnapshot,
  getSavedCartSnapshot,
  parseSavedCart,
  subscribeToCart,
  writeSavedCart,
} from "@/lib/commerce-utils";

describe("browser cart utilities", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

  afterEach(() => {
    if (localStorageDescriptor) {
      Object.defineProperty(window, "localStorage", localStorageDescriptor);
      window.localStorage.clear();
    }
  });

  test("formats minor units using the requested currency and locale", () => {
    expect(formatMoney(12345)).toBe("$123.45");
    expect(formatMoney(12345, "EUR", "de-DE")).toContain("123,45");
    expect(formatMoney(0)).toBe("$0.00");
  });

  test("uses a stable empty snapshot and parses only valid cart records", () => {
    expect(getEmptyCartSnapshot()).toBe("{}");
    expect(parseSavedCart('{"coffee":2,"mug":20}')).toEqual({ coffee: 2, mug: 20 });
    expect(parseSavedCart("not-json")).toEqual({});
    expect(parseSavedCart("[]")).toEqual({});
    expect(parseSavedCart('{"coffee":0}')).toEqual({});
    expect(parseSavedCart('{"coffee":21}')).toEqual({});
    expect(parseSavedCart('{"coffee":"2"}')).toEqual({});
  });

  test("reads the browser snapshot and falls back when storage is unavailable", () => {
    window.localStorage.setItem("commercehub.cart.v1", '{"coffee":2}');
    expect(getSavedCartSnapshot()).toBe('{"coffee":2}');
    window.localStorage.removeItem("commercehub.cart.v1");
    expect(getSavedCartSnapshot()).toBe("{}");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("storage denied");
        },
      },
    });
    expect(getSavedCartSnapshot()).toBe("{}");
  });

  test("writes the cart and notifies local subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToCart(listener);
    const storageListener = jest.fn();
    window.addEventListener("storage", storageListener);

    expect(writeSavedCart({ coffee: 1 })).toBe(true);
    expect(window.localStorage.getItem("commercehub.cart.v1")).toBe('{"coffee":1}');
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("storage"));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    window.dispatchEvent(new Event("commercehub:cart-changed"));
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("storage", storageListener);
  });

  test("reports write failures when browser storage is unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        setItem: () => {
          throw new Error("storage denied");
        },
      },
    });
    expect(writeSavedCart({ coffee: 1 })).toBe(false);
  });
});
