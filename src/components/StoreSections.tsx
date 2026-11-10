"use client";

import Image from "next/image";
import { ArrowRight, Check, Leaf, PackageCheck, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { useContent } from "@/lib/content-context";
import { dataString, dataStringAt } from "@/lib/content-schema";

interface SiteHeaderProps {
  itemCount: number;
  hasLatestOrder: boolean;
  onOpenBag: () => void;
  onViewLatestOrder: () => void;
}

export function DemoRibbon() {
  const { t } = useContent();
  return (
    <div className="demo-ribbon">
      <span className="demo-ribbon-mark">
        <Sparkles size={13} aria-hidden="true" />
      </span>
      <span>{t("app.environmentRibbon")}</span>
      <span className="ribbon-divider" aria-hidden="true" />
      <span>{t("app.environmentRibbonNotice")}</span>
    </div>
  );
}

export function SiteHeader({ itemCount, hasLatestOrder, onOpenBag, onViewLatestOrder }: SiteHeaderProps) {
  const { model, t } = useContent();
  const brandMark = dataString(model, "brand.mark");
  const numberFormat = new Intl.NumberFormat(model.locale);
  return (
    <header className="site-header">
      <a className="brand-lockup" href="#top" aria-label={t("header.home")}>
        <span className="brand-mark" aria-hidden="true">
          {brandMark}
        </span>
        <span className="brand-name">
          {t("brand.wordmarkTop")}
          <br />
          {t("brand.wordmarkBottom")}
        </span>
      </a>
      <nav className="desktop-nav" aria-label={t("header.navigation")}>
        <a href="#collection">{t("header.shop")}</a>
        <a href="#our-approach">{t("header.approach")}</a>
        <a href="#store-policy">{t("header.storeDetails")}</a>
      </nav>
      <div className="header-actions">
        {hasLatestOrder && (
          <button type="button" className="order-lookup-button" onClick={onViewLatestOrder}>
            <PackageCheck size={17} aria-hidden="true" />
            <span>{t("header.latestOrder")}</span>
          </button>
        )}
        <button
          type="button"
          className="bag-trigger"
          onClick={onOpenBag}
          aria-label={t("header.bagCount", { count: numberFormat.format(itemCount) })}
        >
          <ShoppingBag size={18} aria-hidden="true" />
          <span>{t("header.bag")}</span>
          <span className="bag-trigger-count">{itemCount}</span>
        </button>
      </div>
    </header>
  );
}

export function HeroBand() {
  const { model, t } = useContent();
  return (
    <section className="hero-band" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <Leaf size={14} aria-hidden="true" /> {t("hero.eyebrow")}
        </p>
        <h1 id="hero-title">
          {t("hero.titleLead")}
          <br />
          <em>{t("hero.titleEmphasis")}</em>
        </h1>
        <p className="hero-description">{t("hero.description")}</p>
        <a className="hero-cta" href="#collection">
          <span>{t("hero.explore")}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </a>
        <div className="hero-footnote">
          <span className="hero-footnote-line" aria-hidden="true" />
          <span>{t("hero.productCount")}</span>
        </div>
      </div>
      <div className="hero-image-panel">
        <Image
          src="/products/everyday-daypack.jpg"
          alt={dataStringAt(model, "products", "everyday-daypack", "imageAlt")}
          fill
          loading="eager"
          sizes="(max-width: 760px) 100vw, 52vw"
          className="hero-image"
        />
        <div className="hero-image-wash" aria-hidden="true" />
        <div className="hero-image-label">
          <span>{t("hero.imageLabel")}</span>
          <strong>{t("hero.imageCaption")}</strong>
        </div>
        <span className="hero-image-stamp">
          <span>{t("hero.stamp")}</span>
          <span>{dataString(model, "brand.mark").toUpperCase()}</span>
        </span>
      </div>
    </section>
  );
}

export function ShippingRibbon() {
  const { t } = useContent();
  return (
    <div className="shipping-ribbon">
      <span>{t("shipping.left")}</span>
      <span className="shipping-ribbon-center">
        <Check size={15} aria-hidden="true" /> {t("shipping.center")}
      </span>
      <span>{t("shipping.right")}</span>
    </div>
  );
}

export function StoreApproach() {
  const { model, t } = useContent();
  return (
    <section className="approach-band" id="our-approach" aria-labelledby="approach-title">
      <div className="approach-heading">
        <p className="eyebrow">{t("approach.eyebrow")}</p>
        <h2 id="approach-title">
          {t("approach.titleLead")}
          <br />
          <em>{t("approach.titleEmphasis")}</em>
        </h2>
      </div>
      <div className="approach-copy">
        <p>{t("approach.description")}</p>
        <div className="approach-points">
          <div>
            <span>{dataString(model, "approach.point1.index")}</span>
            <strong>{t("approach.point1.title")}</strong>
            <p>{t("approach.point1.description")}</p>
          </div>
          <div>
            <span>{dataString(model, "approach.point2.index")}</span>
            <strong>{t("approach.point2.title")}</strong>
            <p>{t("approach.point2.description")}</p>
          </div>
          <div>
            <span>{dataString(model, "approach.point3.index")}</span>
            <strong>{t("approach.point3.title")}</strong>
            <p>{t("approach.point3.description")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DemoPolicy() {
  const { t } = useContent();
  return (
    <section className="demo-policy" id="store-policy" aria-labelledby="store-policy-title">
      <div className="policy-icon">
        <ShieldCheck size={20} aria-hidden="true" />
      </div>
      <div>
        <h2 id="store-policy-title">{t("policy.title")}</h2>
        <p>{t("policy.description")}</p>
      </div>
      <a href="/privacy">
        {t("policy.privacyLink")} <ArrowRight size={15} aria-hidden="true" />
      </a>
    </section>
  );
}

export function StoreFooter() {
  const { t } = useContent();
  return (
    <footer className="site-footer">
      <a className="footer-wordmark" href="#top">
        {t("brand.name").toLowerCase()}
        <span> / {t("brand.storeContext")}</span>
      </a>
      <div className="footer-links">
        <a href="#collection">{t("footer.shop")}</a>
        <a href="/privacy">{t("footer.privacy")}</a>
        <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
          {t("footer.imageLicense")}
        </a>
      </div>
      <span className="footer-credit">{t("footer.credit")}</span>
    </footer>
  );
}
