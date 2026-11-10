import Image from "next/image";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Product } from "@/lib/commerce-api";
import { useContent } from "@/lib/content-context";
import { dataString, dataStringAt, dataStringFrom } from "@/lib/content-schema";
import { formatMoney } from "@/lib/commerce-utils";

interface ProductCardProps {
  product: Product;
  eagerImage?: boolean;
  onAdd: (product: Product) => void;
  onView: (product: Product) => void;
}

export function ProductCard({ product, eagerImage = false, onAdd, onView }: ProductCardProps) {
  const { model, t } = useContent();
  const name = dataStringAt(model, "products", product.slug, "name");
  const currency = dataString(model, "currency.code");
  return (
    <article className="product-card">
      <button
        type="button"
        className="product-image-button"
        onClick={() => onView(product)}
        aria-label={t("product.viewDetails", { name })}
      >
        <span className="product-image-wrap">
          <Image
            src={product.imageUrl}
            alt={dataStringAt(model, "products", product.slug, "imageAlt")}
            fill
            loading={eagerImage ? "eager" : "lazy"}
            sizes="(max-width: 720px) 48vw, (max-width: 1100px) 31vw, 23vw"
            className="product-image"
          />
        </span>
        <span className="product-category">{dataStringFrom(model, "categoryNames", product.category)}</span>
        {product.featured && <span className="product-featured">{t("product.storeFavorite")}</span>}
        <span className="product-view">
          <ArrowUpRight size={17} aria-hidden="true" />
        </span>
      </button>
      <div className="product-card-copy">
        <div className="product-card-heading">
          <div>
            <h3>{name}</h3>
            <p>{dataStringAt(model, "products", product.slug, "subtitle")}</p>
          </div>
          <strong>{formatMoney(product.priceMinor, currency, model.locale)}</strong>
        </div>
        <div className="product-card-bottom">
          <span className={product.stockQuantity <= 5 ? "stock-note is-low" : "stock-note"}>
            {product.stockQuantity <= 5 ? t("product.fewLeft") : t("product.inStock")}
          </span>
          <button
            type="button"
            className="add-button"
            onClick={() => onAdd(product)}
            disabled={product.stockQuantity === 0}
            aria-label={t("product.addToBag", { name })}
            title={t("product.addTitle")}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
