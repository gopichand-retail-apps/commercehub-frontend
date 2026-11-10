"use client";

import Image from "next/image";
import { ArrowRight, Check, CircleCheck, ShieldCheck, ShoppingBag, X } from "lucide-react";
import { StoreDialog } from "@/components/StoreDialog";
import type { OrderQuote, OrderReceipt, Product } from "@/lib/commerce-api";
import { useContent } from "@/lib/content-context";
import { dataString, dataStringAt, dataStringFrom } from "@/lib/content-schema";
import { formatMoney } from "@/lib/commerce-utils";

interface ProductDialogProps {
  product: Product | null;
  onClose: () => void;
  onAdd: (product: Product) => void;
}

interface CheckoutDialogProps {
  open: boolean;
  quote: OrderQuote | null;
  error: string;
  pending: boolean;
  onClose: () => void;
  onPlaceOrder: () => void;
}

interface ReceiptDialogProps {
  open: boolean;
  receipt: OrderReceipt | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}

export function ProductDialog({ product, onClose, onAdd }: ProductDialogProps) {
  const { model, t } = useContent();
  const currency = dataString(model, "currency.code");
  return (
    <StoreDialog open={Boolean(product)} labelledBy="quick-view-title" className="quick-view-dialog" onClose={onClose}>
      {product && (
        <div className="quick-view-layout">
          <div className="quick-view-image">
            <Image
              src={product.imageUrl}
              alt={dataStringAt(model, "products", product.slug, "imageAlt")}
              fill
              sizes="(max-width: 700px) 100vw, 48vw"
            />
          </div>
          <div className="quick-view-copy">
            <button
              className="dialog-close"
              type="button"
              onClick={onClose}
              autoFocus
              aria-label={t("dialog.closeProduct")}
            >
              <X size={19} aria-hidden="true" />
            </button>
            <p className="eyebrow">{dataStringFrom(model, "categoryNames", product.category)}</p>
            <h2 id="quick-view-title">{dataStringAt(model, "products", product.slug, "name")}</h2>
            <p className="quick-view-subtitle">{dataStringAt(model, "products", product.slug, "subtitle")}</p>
            <p className="quick-view-description">{dataStringAt(model, "products", product.slug, "description")}</p>
            <div className="quick-view-price">
              <strong>{formatMoney(product.priceMinor, currency, model.locale)}</strong>
              <span>{product.stockQuantity <= 5 ? t("dialog.quickFewLeft") : t("dialog.quickAvailable")}</span>
            </div>
            <button
              type="button"
              className="solid-button quick-add-button"
              onClick={() => onAdd(product)}
              disabled={product.stockQuantity === 0}
            >
              <ShoppingBag size={17} aria-hidden="true" /> {t("dialog.addToBag")}
            </button>
            <p className="small-demo-copy">{t("dialog.fictionalItem")}</p>
          </div>
        </div>
      )}
    </StoreDialog>
  );
}

export function CheckoutDialog({ open, quote, error, pending, onClose, onPlaceOrder }: CheckoutDialogProps) {
  const { t } = useContent();
  return (
    <StoreDialog open={open} labelledBy="checkout-title" className="checkout-dialog" onClose={onClose}>
      <div className="dialog-content">
        <button className="dialog-close" type="button" onClick={onClose} autoFocus aria-label={t("checkout.close")}>
          <X size={19} aria-hidden="true" />
        </button>
        <p className="eyebrow">{t("checkout.eyebrow")}</p>
        <h2 id="checkout-title">{t("checkout.title")}</h2>
        <p className="dialog-lede">{t("checkout.description")}</p>
        {quote && <CheckoutSummary quote={quote} />}
        <div className="simulated-payment" aria-label={t("checkout.paymentMethod")}>
          <span className="simulation-check">
            <Check size={14} aria-hidden="true" />
          </span>
          <span>
            <strong>{t("checkout.sandboxPayment")}</strong>
            <small>{t("checkout.sandboxDescription")}</small>
          </span>
          <span className="simulation-label">{t("checkout.simulatedTag")}</span>
        </div>
        {error && (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="solid-button place-order-button"
          onClick={onPlaceOrder}
          disabled={!quote || pending}
        >
          {pending ? t("checkout.pending") : t("checkout.placeOrder")}
          {!pending && <ArrowRight size={17} aria-hidden="true" />}
        </button>
        <p className="small-demo-copy">
          <ShieldCheck size={14} aria-hidden="true" /> {t("checkout.safety")}
        </p>
      </div>
    </StoreDialog>
  );
}

function CheckoutSummary({ quote }: { quote: OrderQuote }) {
  const { model, t } = useContent();
  return (
    <div className="checkout-summary">
      {quote.lines.map((line) => (
        <div className="checkout-summary-item" key={line.productId}>
          <span>
            {line.quantity} × {dataStringAt(model, "products", line.slug, "name")}
          </span>
          <strong>{formatMoney(line.totalMinor, quote.currency, model.locale)}</strong>
        </div>
      ))}
      <div>
        <span>{t("checkout.receiptSubtotal")}</span>
        <strong>{formatMoney(quote.subtotalMinor, quote.currency, model.locale)}</strong>
      </div>
      {quote.discountMinor > 0 && (
        <div>
          <span>{t("checkout.receiptDiscount")}</span>
          <strong>−{formatMoney(quote.discountMinor, quote.currency, model.locale)}</strong>
        </div>
      )}
      <div>
        <span>{t("checkout.receiptShipping")}</span>
        <strong>
          {quote.shippingMinor === 0
            ? t("cart.complimentary")
            : formatMoney(quote.shippingMinor, quote.currency, model.locale)}
        </strong>
      </div>
      <div>
        <span>{t("checkout.receiptTax")}</span>
        <strong>{formatMoney(quote.taxMinor, quote.currency, model.locale)}</strong>
      </div>
      <div className="checkout-summary-total">
        <span>{t("checkout.receiptTotal")}</span>
        <strong>{formatMoney(quote.totalMinor, quote.currency, model.locale)}</strong>
      </div>
    </div>
  );
}

export function ReceiptDialog({ open, receipt, loading, error, onClose }: ReceiptDialogProps) {
  const { model, t } = useContent();
  return (
    <StoreDialog open={open} labelledBy="receipt-title" className="receipt-dialog" onClose={onClose}>
      {receipt && (
        <div className="receipt-content">
          <button className="dialog-close" type="button" onClick={onClose} autoFocus aria-label={t("receipt.close")}>
            <X size={19} aria-hidden="true" />
          </button>
          <span className="receipt-icon">
            <CircleCheck size={28} aria-hidden="true" />
          </span>
          <p className="eyebrow">{t("receipt.eyebrow")}</p>
          <h2 id="receipt-title">{t("receipt.title")}</h2>
          <p className="dialog-lede">{t("receipt.description")}</p>
          <div className="receipt-reference">
            <span>{t("receipt.reference")}</span>
            <strong>{receipt.orderId.slice(0, 8).toUpperCase()}</strong>
            <span className="receipt-status">
              <Check size={13} aria-hidden="true" /> {t(`status.${receipt.status}`)}
            </span>
          </div>
          <div className="receipt-items">
            {receipt.items.map((item) => (
              <div key={item.productId}>
                <span>
                  {item.quantity} ×{" "}
                  {dataStringAt(model, "products", dataStringFrom(model, "productSlugsById", item.productId), "name")}
                </span>
                <strong>{formatMoney(item.totalMinor, receipt.currency, model.locale)}</strong>
              </div>
            ))}
            <div className="receipt-total">
              <span>{t("receipt.orderTotal")}</span>
              <strong>{formatMoney(receipt.totalMinor, receipt.currency, model.locale)}</strong>
            </div>
          </div>
          {loading && (
            <p className="quote-status" role="status">
              {t("receipt.loading")}
            </p>
          )}
          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="outline-button receipt-close-button" onClick={onClose}>
            {t("receipt.backToShop")}
          </button>
          <p className="small-demo-copy">{t("receipt.synthetic")}</p>
        </div>
      )}
    </StoreDialog>
  );
}
