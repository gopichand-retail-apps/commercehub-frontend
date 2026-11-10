/** @jest-environment node */

import { getEmptyCartSnapshot, subscribeToCart } from "@/lib/commerce-utils";

test("cart subscription is a no-op when rendered without a browser window", () => {
  expect(typeof window).toBe("undefined");
  expect(getEmptyCartSnapshot()).toBe("{}");

  const unsubscribe = subscribeToCart(() => {
    throw new Error("server subscription should not attach listeners");
  });

  expect(unsubscribe()).toBeUndefined();
});
