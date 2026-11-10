"use client";

import type { IdentityMode, IdentityStatus } from "@/hooks/useSyntheticIdentity";
import { APP_VERSION } from "@/app-version";
import { useContent } from "@/lib/content-context";

interface SyntheticIdentityPanelProps {
  mode: IdentityMode;
  roleCodes: string[];
  selectedRoleCode: string;
  checkoutRoleCode: string;
  status: IdentityStatus;
  error: string;
  revocationWarning: boolean;
  onSelectRole: (role: string) => void;
}

export function SyntheticIdentityPanel({
  mode,
  roleCodes,
  selectedRoleCode,
  checkoutRoleCode,
  status,
  error,
  revocationWarning,
  onSelectRole,
}: SyntheticIdentityPanelProps) {
  const { t } = useContent();
  const isLoading = status === "loading";

  return (
    <section className="identity-panel" aria-label={t("identity.panelLabel")}>
      <div className="identity-panel-copy">
        <p className="identity-panel-title">{t("identity.panelLabel")}</p>
        <p className="identity-panel-mode">
          {t("identity.modeLabel")}: <strong>{t(mode === "mock" ? "identity.modeMock" : "identity.modeServer")}</strong>
        </p>
        <p className="identity-panel-version">{t("app.releaseVersion", { version: APP_VERSION })}</p>
      </div>
      <div className="identity-panel-role">
        <label htmlFor="synthetic-role">{t("identity.roleLabel")}</label>
        <select
          id="synthetic-role"
          value={selectedRoleCode}
          disabled={isLoading || roleCodes.length === 0}
          onChange={(event) => onSelectRole(event.target.value)}
        >
          {!selectedRoleCode && <option value="">{t("identity.rolePlaceholder")}</option>}
          {roleCodes.map((role) => (
            <option value={role} key={role}>
              {t(`identity.role.${role}`)}
            </option>
          ))}
        </select>
      </div>
      {isLoading && (
        <p className="identity-panel-status" role="status" aria-live="polite">
          {t("identity.loading")}
        </p>
      )}
      {status === "ready" && selectedRoleCode && selectedRoleCode !== checkoutRoleCode && (
        <p className="identity-panel-status" role="status" aria-live="polite">
          {t("identity.customerOnly")}
        </p>
      )}
      {status === "ready" && (
        <p className="identity-panel-status" role="status">
          {t("identity.sessionReady")}
        </p>
      )}
      {status === "expired" && (
        <div className="identity-panel-error identity-session-expired" role="alert">
          <span>{t("identity.sessionExpired")}</span>
          <button className="identity-session-retry" onClick={() => onSelectRole(selectedRoleCode)} type="button">
            {t("identity.reauthenticate")}
          </button>
        </div>
      )}
      {error && (
        <p className="identity-panel-error" role="alert">
          {error}
        </p>
      )}
      {revocationWarning && (
        <p className="identity-panel-error" role="alert">
          {t("identity.previousSessionNotRevoked")}
        </p>
      )}
    </section>
  );
}
