"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useContent } from "@/lib/content-context";

export default function PrivacyPage() {
  const { t } = useContent();
  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <Link className="footer-wordmark" href="/">
          {t("brand.name").toLowerCase()}
          <span> / {t("brand.storeContext")}</span>
        </Link>
        <Link href="/" aria-label={t("privacy.return")}>
          <ArrowLeft size={17} aria-hidden="true" /> {t("privacy.back")}
        </Link>
      </header>
      <article className="privacy-content">
        <span className="policy-icon">
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <p className="eyebrow">{t("privacy.eyebrow")}</p>
        <h1>{t("privacy.title")}</h1>
        <p>{t("privacy.introduction")}</p>

        <h2>{t("privacy.collectionTitle")}</h2>
        <ul>
          <li>{t("privacy.cartStorage")}</li>
          <li>{t("privacy.noPersonalInfo")}</li>
          <li>{t("privacy.accessKey")}</li>
          <li>{t("privacy.analytics")}</li>
        </ul>

        <h2>{t("privacy.paymentsTitle")}</h2>
        <p>{t("privacy.paymentsDescription")}</p>

        <h2>{t("privacy.localDataTitle")}</h2>
        <p>{t("privacy.localDataDescription")}</p>

        <p className="privacy-callout">{t("privacy.callout")}</p>
      </article>
    </main>
  );
}
