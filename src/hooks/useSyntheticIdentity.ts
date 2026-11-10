"use client";

import { useCallback, useEffect, useState } from "react";
import { CommerceApiError, commerceApi, type SyntheticSession } from "@/lib/commerce-api";
import { isMock } from "@/lib/config";
import { dataString } from "@/lib/content-schema";
import type { ContentModel } from "@/lib/content-schema";
import {
  clearStoredSyntheticSession,
  MOCK_ROLE_STORAGE_KEY,
  readStoredSyntheticSession,
  resolveRoleCodes,
  storeSyntheticSession,
} from "@/lib/synthetic-identity";

export type IdentityMode = "mock" | "server";
export type IdentityStatus = "loading" | "ready" | "error" | "expired";

export function useSyntheticIdentity(model: ContentModel) {
  const mode: IdentityMode = isMock ? "mock" : "server";
  const [status, setStatus] = useState<IdentityStatus>("loading");
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [session, setSession] = useState<SyntheticSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revocationWarning, setRevocationWarning] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    void loadIdentity(signal)
      .then((identity) => {
        if (signal.aborted) return;
        setRoleCodes(identity.roleCodes);
        setSelectedRoleCode(identity.role);
        setSession(identity.session);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (signal.aborted) return;
        setError(cause);
        setStatus("error");
      });

    async function loadIdentity(signal: AbortSignal) {
      const roles = await resolveRoleCodes(async () => {
        const result = await commerceApi.syntheticRoles(signal);
        return result.roles;
      });
      if (roles.some((role) => !Object.hasOwn(model.messages, `identity.role.${role}`))) {
        throw new CommerceApiError("Role label missing from content model", 502, "INVALID_RESPONSE");
      }

      const stored = readStoredSyntheticSession(window.sessionStorage);
      if (stored && roles.includes(stored.role)) {
        try {
          const current = await commerceApi.currentSyntheticSession(stored.token, signal);
          if (roles.includes(current.role)) {
            return {
              roleCodes: roles,
              role: current.role,
              session: { ...current, token: stored.token },
            };
          }
        } catch (cause) {
          if (!isInvalidSession(cause)) throw cause;
        }
      }
      if (stored) clearStoredSyntheticSession(window.sessionStorage);

      const preferredRole = [
        dataString(model, "identity.checkoutRoleCode"),
        window.sessionStorage.getItem(MOCK_ROLE_STORAGE_KEY),
      ].find((role): role is string => role !== null && roles.includes(role));
      const role = preferredRole ?? roles[0];
      if (!role) throw new CommerceApiError("No demo roles are available", 502, "INVALID_RESPONSE");
      const created = await commerceApi.createSyntheticSession(role, signal);
      storeSyntheticSession(window.sessionStorage, created);
      return { roleCodes: roles, role, session: created };
    }

    return () => controller.abort();
  }, [model]);

  const selectRole = useCallback(
    async (role: string) => {
      if (!roleCodes.includes(role) || status === "loading") return;
      if (role === selectedRoleCode && status === "ready") return;

      setStatus("loading");
      setError(null);
      setRevocationWarning(false);
      try {
        const created = await commerceApi.createSyntheticSession(role);
        if (session) {
          try {
            await commerceApi.revokeSyntheticSession(session.token);
          } catch (cause) {
            if (!isInvalidSession(cause)) setRevocationWarning(true);
          }
        }
        storeSyntheticSession(window.sessionStorage, created);
        setSession(created);
        setSelectedRoleCode(role);
        setStatus("ready");
      } catch (cause) {
        setError(cause);
        setStatus("error");
      }
    },
    [roleCodes, selectedRoleCode, session, status],
  );

  const expireSession = useCallback(() => {
    clearStoredSyntheticSession(window.sessionStorage);
    setSession(null);
    setStatus("expired");
    setError(null);
    setRevocationWarning(false);
  }, []);

  return {
    error,
    expireSession,
    isMock,
    mode,
    revocationWarning,
    roleCodes,
    selectedRoleCode,
    selectRole,
    session,
    status,
  };
}

function isInvalidSession(cause: unknown): boolean {
  return cause instanceof CommerceApiError && cause.status === 401;
}
