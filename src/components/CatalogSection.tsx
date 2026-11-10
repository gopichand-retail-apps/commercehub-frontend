"use client";

import { ChevronDown, Search, X } from "lucide-react";
import type { Product } from "@/lib/commerce-api";
import { useContent } from "@/lib/content-context";
import { ProductCard } from "@/components/ProductCard";

export type CatalogState = "loading" | "ready" | "error";

interface CatalogSectionProps {
  visibleProducts: Product[];
  categories: Array<{ id: string; label: string }>;
  activeCategory: string;
  query: string;
  sortOrder: string;
  catalogState: CatalogState;
  catalogError: string;
  quoteUpdating: boolean;
  onCategoryChange: (category: string) => void;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onSortChange: (value: string) => void;
  onRetry: () => void;
  onResetFilters: () => void;
  onAdd: (product: Product) => void;
  onView: (product: Product) => void;
}

export function CatalogSection({
  visibleProducts,
  categories,
  activeCategory,
  query,
  sortOrder,
  catalogState,
  catalogError,
  quoteUpdating,
  onCategoryChange,
  onQueryChange,
  onClearQuery,
  onSortChange,
  onRetry,
  onResetFilters,
  onAdd,
  onView,
}: CatalogSectionProps) {
  const { model, t } = useContent();
  const numberFormat = new Intl.NumberFormat(model.locale);
  return (
    <section className="collection-section" id="collection" aria-labelledby="collection-title">
      <div className="collection-heading">
        <div>
          <p className="eyebrow">{t("catalog.eyebrow")}</p>
          <h2 id="collection-title">{t("catalog.title")}</h2>
        </div>
        <p className="collection-intro">{t("catalog.description")}</p>
      </div>

      <div className="catalog-toolbar">
        <div className="category-tabs" role="group" aria-label={t("catalog.filterCategories")}>
          {categories.map((category) => (
            <button
              className={activeCategory === category.id ? "category-tab is-active" : "category-tab"}
              key={category.id}
              type="button"
              aria-pressed={activeCategory === category.id}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="catalog-controls">
          <label className="search-control">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">{t("catalog.searchLabel")}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t("catalog.searchPlaceholder")}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="clear-search"
                onClick={onClearQuery}
                aria-label={t("catalog.clearSearch")}
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
          <label className="sort-control">
            <span className="sr-only">{t("catalog.sortLabel")}</span>
            <select value={sortOrder} onChange={(event) => onSortChange(event.target.value)}>
              <option value="featured">{t("catalog.sort.featured")}</option>
              <option value="price-low">{t("catalog.sort.lowHigh")}</option>
              <option value="price-high">{t("catalog.sort.highLow")}</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>
      </div>

      <div className="collection-meta" aria-live="polite">
        <span>
          {catalogState === "ready"
            ? t("catalog.goodsCount", { count: numberFormat.format(visibleProducts.length) })
            : t("catalog.collection")}
        </span>
        {quoteUpdating && (
          <span className="price-refresh">
            <span className="status-dot" /> {t("catalog.quoteUpdating")}
          </span>
        )}
      </div>

      {catalogState === "loading" && (
        <div className="product-grid" aria-label={t("catalog.loading")} aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="product-skeleton" key={index} />
          ))}
        </div>
      )}
      {catalogState === "error" && (
        <div className="catalog-state" role="alert">
          <div className="catalog-state-icon">
            <X size={21} aria-hidden="true" />
          </div>
          <h3>{t("catalog.errorTitle")}</h3>
          <p>{catalogError || t("errors.requestFailed")}</p>
          <button type="button" className="outline-button" onClick={onRetry}>
            {t("catalog.tryAgain")}
          </button>
        </div>
      )}
      {catalogState === "ready" && visibleProducts.length > 0 && (
        <div className="product-grid">
          {visibleProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} eagerImage={index < 3} onAdd={onAdd} onView={onView} />
          ))}
        </div>
      )}
      {catalogState === "ready" && visibleProducts.length === 0 && (
        <div className="catalog-state">
          <div className="catalog-state-icon">
            <Search size={21} aria-hidden="true" />
          </div>
          <h3>{t("catalog.emptyTitle")}</h3>
          <p>{t("catalog.emptyDescription")}</p>
          <button type="button" className="outline-button" onClick={onResetFilters}>
            {t("catalog.showAll")}
          </button>
        </div>
      )}
    </section>
  );
}
