"use client";

import { Minus, PackageCheck, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useId } from "react";
import { StoreDialog } from "@/components/StoreDialog";
import type { OrderQuote, Product } from "@/lib/commerce-api";
import { useContent } from "@/lib/content-context";
import { dataStringAt } from "@/lib/content-schema";
import { formatMoney } from "@/lib/commerce-utils";

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartPanelProps {
  lines: CartLine[];
  quote: OrderQuote | null;
  quoteState: "idle" | "loading" | "ready" | "error";
  quoteError: string;
  promoCode: string;
  promoDraft: string;
  isCheckoutPending: boolean;
  latestOrder: boolean;
  canCheckout: boolean;
  mobileOpen: boolean;
  onQuantityChange: (productId: string, quantity: number) => void;
  onPromoDraftChange: (value: string) => void;
  onApplyPromo: () => void;
  onClearPromo: () => void;
  onCheckout: () => void;
  onViewOrder: () => void;
  onCloseMobile: () => void;
}

export function CartPanel({
  lines,
  quote,
  quoteState,
  quoteError,
  promoCode,
  promoDraft,
  isCheckoutPending,
  latestOrder,
  canCheckout,
  mobileOpen,
  onQuantityChange,
  onPromoDraftChange,
  onApplyPromo,
  onClearPromo,
  onCheckout,
  onViewOrder,
  onCloseMobile,
}: CartPanelProps) {
  const { model, t } = useContent();
  const numberFormat = new Intl.NumberFormat(model.locale);
  const promoInputId = useId();
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <StoreDialog open={mobileOpen} labelledBy="cart-title" className="cart-dialog" onClose={onCloseMobile}>
      <aside className="cart-panel" aria-labelledby="cart-title">
        <div className="cart-panel-header">
          <div>
            <span className="eyebrow">{t("cart.eyebrow")}</span>
            <h2 id="cart-title">{t("cart.title")}</h2>
          </div>
          <div className="cart-panel-actions">
            {latestOrder && (
              <button
                className="icon-button order-status-button"
                type="button"
                onClick={onViewOrder}
                title={t("cart.viewLatestOrder")}
              >
                <PackageCheck size={18} aria-hidden="true" />
                <span className="sr-only">{t("cart.latestOrderAction")}</span>
              </button>
            )}
            <button
              className="icon-button mobile-close"
              type="button"
              onClick={onCloseMobile}
              title={t("cart.closeBag")}
            >
              <X size={19} aria-hidden="true" />
              <span className="sr-only">{t("cart.closeBag")}</span>
            </button>
            <span className="cart-count" aria-label={t("cart.count", { count: numberFormat.format(itemCount) })}>
              {itemCount}
            </span>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="empty-cart">
            <span className="empty-cart-icon">
              <ShoppingBag size={23} aria-hidden="true" />
            </span>
            <h3>{t("cart.emptyTitle")}</h3>
            <p>{t("cart.emptyDescription")}</p>
            <a href="#collection" onClick={onCloseMobile}>
              {t("cart.browse")}
            </a>
          </div>
        ) : (
          <>
            <div className="cart-lines" aria-label={t("cart.itemsLabel")}>
              {lines.map(({ product, quantity }) => (
                <article className="cart-line" key={product.id}>
                  <Image src={product.imageUrl} alt="" width={72} height={84} />
                  <div className="cart-line-main">
                    <div className="cart-line-title">
                      <div>
                        <h3>{dataStringAt(model, "products", product.slug, "name")}</h3>
                        <span>{formatMoney(product.priceMinor, quote?.currency ?? "USD", model.locale)}</span>
                      </div>
                      <button
                        className="icon-button remove-item"
                        type="button"
                        onClick={() => onQuantityChange(product.id, 0)}
                        aria-label={t("cart.removeItem", {
                          name: dataStringAt(model, "products", product.slug, "name"),
                        })}
                        title={t("cart.removeItemTitle")}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <div
                      className="quantity-control"
                      aria-label={t("cart.quantity", {
                        name: dataStringAt(model, "products", product.slug, "name"),
                      })}
                    >
                      <button
                        type="button"
                        onClick={() => onQuantityChange(product.id, quantity - 1)}
                        aria-label={t("cart.removeOne", {
                          name: dataStringAt(model, "products", product.slug, "name"),
                        })}
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <span aria-live="polite">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(product.id, quantity + 1)}
                        disabled={quantity >= product.stockQuantity}
                        aria-label={t("cart.addOne", {
                          name: dataStringAt(model, "products", product.slug, "name"),
                        })}
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="promo-block">
              <form
                className="promo-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onApplyPromo();
                }}
              >
                <label htmlFor={promoInputId}>
                  <Tag size={15} aria-hidden="true" /> {t("cart.promoLabel")}
                </label>
                <div className="promo-input-row">
                  <input
                    id={promoInputId}
                    value={promoDraft}
                    onChange={(event) => onPromoDraftChange(event.target.value)}
                    placeholder={t("cart.promoPlaceholder")}
                    autoComplete="off"
                    maxLength={32}
                  />
                  {promoCode ? (
                    <button className="text-button" type="button" onClick={onClearPromo}>
                      {t("cart.removePromo")}
                    </button>
                  ) : (
                    <button className="text-button" type="submit" disabled={!promoDraft.trim()}>
                      {t("cart.applyPromo")}
                    </button>
                  )}
                </div>
                {promoCode && <span className="promo-applied">{t("cart.promoApplied", { code: promoCode })}</span>}
              </form>
            </div>

            <div className="quote-area" aria-live="polite" aria-busy={quoteState === "loading"}>
              {quoteState === "loading" && <p className="quote-status">{t("cart.refreshingQuote")}</p>}
              {quoteState === "error" && (
                <p className="quote-error" role="alert">
                  {quoteError || t("errors.requestFailed")}
                </p>
              )}
              {quote && quoteState === "ready" && (
                <div className="quote-lines">
                  <div>
                    <span>{t("cart.subtotal")}</span>
                    <strong>{formatMoney(quote.subtotalMinor, quote.currency, model.locale)}</strong>
                  </div>
                  {quote.discountMinor > 0 && (
                    <div className="discount-line">
                      <span>{t("cart.discount")}</span>
                      <strong>−{formatMoney(quote.discountMinor, quote.currency, model.locale)}</strong>
                    </div>
                  )}
                  <div>
                    <span>{t("cart.shipping")}</span>
                    <strong>
                      {quote.shippingMinor === 0
                        ? t("cart.complimentary")
                        : formatMoney(quote.shippingMinor, quote.currency, model.locale)}
                    </strong>
                  </div>
                  <div>
                    <span>{t("cart.estimatedTax")}</span>
                    <strong>{formatMoney(quote.taxMinor, quote.currency, model.locale)}</strong>
                  </div>
                  <div className="quote-total">
                    <span>{t("cart.total")}</span>
                    <strong>{formatMoney(quote.totalMinor, quote.currency, model.locale)}</strong>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="checkout-button"
              onClick={onCheckout}
              disabled={!quote || quoteState !== "ready" || isCheckoutPending || !canCheckout}
            >
              <span>{isCheckoutPending ? t("cart.checkoutPending") : t("cart.checkout")}</span>
              <strong>{quote ? formatMoney(quote.totalMinor, quote.currency, model.locale) : "—"}</strong>
            </button>
            <p className="checkout-footnote">{t("cart.checkoutSafety")}</p>
            <p className="shipping-note">{t("cart.shippingNote")}</p>
          </>
        )}
      </aside>
    </StoreDialog>
  );
}
