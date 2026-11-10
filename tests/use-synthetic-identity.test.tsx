import { act, renderHook, waitFor } from "@testing-library/react";
import { CommerceApiError, commerceApi, type CurrentSyntheticSession } from "@/lib/commerce-api";
import { useSyntheticIdentity } from "@/hooks/useSyntheticIdentity";
import { MOCK_ROLE_STORAGE_KEY, SESSION_ROLE_STORAGE_KEY, SESSION_TOKEN_STORAGE_KEY } from "@/lib/synthetic-identity";
import type { ContentModel } from "@/lib/content-schema";
import { model, syntheticSession } from "./test-utils";

const roles = ["CUSTOMER", "MERCHANT", "SUPPORT"];

function currentSession(role: string): CurrentSyntheticSession {
  const session = syntheticSession(role);
  return { id: session.id, role: session.role, expiresAt: session.expiresAt };
}

function mockInitialSession() {
  jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles });
  jest.spyOn(commerceApi, "currentSyntheticSession").mockResolvedValue(currentSession("CUSTOMER"));
  jest.spyOn(commerceApi, "createSyntheticSession").mockResolvedValue(syntheticSession());
  jest.spyOn(commerceApi, "revokeSyntheticSession").mockResolvedValue();
}

describe("synthetic identity lifecycle", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("loads API roles and creates a server-issued local identity when no session is stored", async () => {
    mockInitialSession();
    const { result } = renderHook(() => useSyntheticIdentity(model));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.mode).toBe("mock");
    expect(result.current.roleCodes).toEqual(roles);
    expect(result.current.selectedRoleCode).toBe("CUSTOMER");
    expect(result.current.session).toEqual(syntheticSession());
    expect(commerceApi.createSyntheticSession).toHaveBeenCalledWith("CUSTOMER", expect.any(AbortSignal));
    expect(window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe(syntheticSession().token);
    expect(window.sessionStorage.getItem(SESSION_ROLE_STORAGE_KEY)).toBe("CUSTOMER");
  });

  test("reuses a stored session only after the backend confirms its role", async () => {
    const stored = syntheticSession();
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, stored.token);
    window.sessionStorage.setItem(SESSION_ROLE_STORAGE_KEY, stored.role);
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles });
    jest.spyOn(commerceApi, "currentSyntheticSession").mockResolvedValue(currentSession("CUSTOMER"));
    const createSession = jest.spyOn(commerceApi, "createSyntheticSession");

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.session).toEqual(stored);
    expect(commerceApi.currentSyntheticSession).toHaveBeenCalledWith(stored.token, expect.any(AbortSignal));
    expect(createSession).not.toHaveBeenCalled();
  });

  test("clears an invalid session and creates a replacement", async () => {
    const stored = syntheticSession();
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, stored.token);
    window.sessionStorage.setItem(SESSION_ROLE_STORAGE_KEY, stored.role);
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles });
    jest
      .spyOn(commerceApi, "currentSyntheticSession")
      .mockRejectedValue(new CommerceApiError("expired", 401, "SESSION_INVALID"));
    const createSession = jest.spyOn(commerceApi, "createSyntheticSession").mockResolvedValue(syntheticSession());

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(createSession).toHaveBeenCalledWith("CUSTOMER", expect.any(AbortSignal));
    expect(result.current.error).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe(syntheticSession().token);
  });

  test("clears an expired active session and requires an explicit replacement", async () => {
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles });
    const createSession = jest.spyOn(commerceApi, "createSyntheticSession").mockResolvedValue(syntheticSession());

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.expireSession());

    expect(result.current.status).toBe("expired");
    expect(result.current.session).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_ROLE_STORAGE_KEY)).toBeNull();
    expect(createSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.selectRole("CUSTOMER");
    });

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenLastCalledWith("CUSTOMER");
    expect(result.current.status).toBe("ready");
  });

  test("ignores a stored role removed from the server role list", async () => {
    const stored = syntheticSession("MERCHANT");
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, stored.token);
    window.sessionStorage.setItem(SESSION_ROLE_STORAGE_KEY, stored.role);
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles: ["CUSTOMER"] });
    const current = jest.spyOn(commerceApi, "currentSyntheticSession");
    const createSession = jest.spyOn(commerceApi, "createSyntheticSession").mockResolvedValue(syntheticSession());

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(current).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith("CUSTOMER", expect.any(AbortSignal));
    expect(result.current.selectedRoleCode).toBe("CUSTOMER");
  });

  test("falls back to the first server role when no saved preference remains available", async () => {
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles: ["SUPPORT"] });
    const createSession = jest
      .spyOn(commerceApi, "createSyntheticSession")
      .mockResolvedValue(syntheticSession("SUPPORT"));

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(createSession).toHaveBeenCalledWith("SUPPORT", expect.any(AbortSignal));
    expect(result.current.selectedRoleCode).toBe("SUPPORT");
  });

  test("surfaces non-session failures while validating a previously stored token", async () => {
    const stored = syntheticSession();
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, stored.token);
    window.sessionStorage.setItem(SESSION_ROLE_STORAGE_KEY, stored.role);
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles });
    jest
      .spyOn(commerceApi, "currentSyntheticSession")
      .mockRejectedValue(new CommerceApiError("temporarily unavailable", 503, "REQUEST_FAILED"));
    const createSession = jest.spyOn(commerceApi, "createSyntheticSession");

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toEqual(new CommerceApiError("temporarily unavailable", 503, "REQUEST_FAILED"));
    expect(createSession).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe(stored.token);
  });

  test("replaces a session whose current role no longer belongs to the backend role list", async () => {
    const stored = syntheticSession();
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, stored.token);
    window.sessionStorage.setItem(SESSION_ROLE_STORAGE_KEY, stored.role);
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles: ["CUSTOMER"] });
    jest.spyOn(commerceApi, "currentSyntheticSession").mockResolvedValue(currentSession("MERCHANT"));
    const createSession = jest.spyOn(commerceApi, "createSyntheticSession").mockResolvedValue(syntheticSession());

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(createSession).toHaveBeenCalledWith("CUSTOMER", expect.any(AbortSignal));
    expect(result.current.selectedRoleCode).toBe("CUSTOMER");
  });

  test("honors a locally remembered role when the backend still offers it", async () => {
    window.sessionStorage.setItem(MOCK_ROLE_STORAGE_KEY, "MERCHANT");
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles: ["MERCHANT"] });
    const createSession = jest
      .spyOn(commerceApi, "createSyntheticSession")
      .mockResolvedValue(syntheticSession("MERCHANT"));

    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(createSession).toHaveBeenCalledWith("MERCHANT", expect.any(AbortSignal));
    expect(result.current.selectedRoleCode).toBe("MERCHANT");
  });

  test("reports invalid response when a server role has no content-model label", async () => {
    mockInitialSession();
    const incompleteModel: ContentModel = {
      ...model,
      messages: { ...model.messages },
    };
    delete incompleteModel.messages["identity.role.CUSTOMER"];

    const { result } = renderHook(() => useSyntheticIdentity(incompleteModel));
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
    });
    expect(commerceApi.createSyntheticSession).not.toHaveBeenCalled();
  });

  test("surfaces non-session API failures and invalid server role lists", async () => {
    jest.spyOn(commerceApi, "syntheticRoles").mockRejectedValue(new Error("network unavailable"));
    const failedRoles = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(failedRoles.result.current.status).toBe("error"));
    expect(failedRoles.result.current.error).toEqual(new Error("network unavailable"));
    failedRoles.unmount();

    jest.restoreAllMocks();
    jest.spyOn(commerceApi, "syntheticRoles").mockResolvedValue({ roles: ["not-a-role"] });
    const invalidRoles = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(invalidRoles.result.current.status).toBe("error"));
    expect(invalidRoles.result.current.error).toEqual(new Error("SYNTHETIC_ROLES_INVALID"));
  });

  test("ignores delayed identity failures after the component unmounts", async () => {
    let rejectRoles: (reason: unknown) => void = () => {};
    jest.spyOn(commerceApi, "syntheticRoles").mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRoles = reject;
      }),
    );
    const view = renderHook(() => useSyntheticIdentity(model));

    view.unmount();
    await act(async () => {
      rejectRoles(new Error("aborted"));
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  test("ignores unavailable, loading, and unchanged role selections", async () => {
    mockInitialSession();
    const { result } = renderHook(() => useSyntheticIdentity(model));

    act(() => {
      void result.current.selectRole("MERCHANT");
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => {
      await result.current.selectRole("UNKNOWN");
      await result.current.selectRole("CUSTOMER");
    });

    expect(commerceApi.createSyntheticSession).toHaveBeenCalledTimes(1);
  });

  test("creates the selected role and revokes the previous session", async () => {
    mockInitialSession();
    const createSession = jest
      .spyOn(commerceApi, "createSyntheticSession")
      .mockResolvedValueOnce(syntheticSession())
      .mockResolvedValueOnce(syntheticSession("MERCHANT"));
    const revokeSession = jest.spyOn(commerceApi, "revokeSyntheticSession").mockResolvedValue();
    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.selectRole("MERCHANT");
    });

    expect(createSession).toHaveBeenLastCalledWith("MERCHANT");
    expect(revokeSession).toHaveBeenCalledWith(syntheticSession().token);
    expect(result.current.status).toBe("ready");
    expect(result.current.selectedRoleCode).toBe("MERCHANT");
    expect(result.current.revocationWarning).toBe(false);
  });

  test.each([
    ["an expired previous session", new CommerceApiError("expired", 401, "SESSION_INVALID"), false],
    ["a failed revocation", new Error("backend unavailable"), true],
  ])("completes role changes after %s", async (_description, revocationError, shouldWarn) => {
    mockInitialSession();
    jest
      .spyOn(commerceApi, "createSyntheticSession")
      .mockResolvedValueOnce(syntheticSession())
      .mockResolvedValueOnce(syntheticSession("MERCHANT"));
    jest.spyOn(commerceApi, "revokeSyntheticSession").mockRejectedValue(revocationError);
    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.selectRole("MERCHANT");
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.revocationWarning).toBe(shouldWarn);
    expect(result.current.selectedRoleCode).toBe("MERCHANT");
  });

  test("reports errors when creating a replacement role fails", async () => {
    mockInitialSession();
    jest
      .spyOn(commerceApi, "createSyntheticSession")
      .mockResolvedValueOnce(syntheticSession())
      .mockRejectedValueOnce(new Error("session service unavailable"));
    const { result } = renderHook(() => useSyntheticIdentity(model));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.selectRole("MERCHANT");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual(new Error("session service unavailable"));
    expect(result.current.revocationWarning).toBe(false);
  });
});
