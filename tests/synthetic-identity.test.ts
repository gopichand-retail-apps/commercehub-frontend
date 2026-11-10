import {
  clearStoredSyntheticSession,
  MOCK_ROLE_STORAGE_KEY,
  readStoredSyntheticSession,
  resolveRoleCodes,
  SESSION_ROLE_STORAGE_KEY,
  SESSION_TOKEN_STORAGE_KEY,
  storeSyntheticSession,
  type SessionStoragePort,
} from "@/lib/synthetic-identity";

function createStorage() {
  const values = new Map<string, string>();
  const storage: SessionStoragePort = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return { storage, values };
}

describe("synthetic identity storage and API role validation", () => {
  test("accepts unique server role codes and rejects malformed role responses", async () => {
    await expect(resolveRoleCodes(async () => ["CUSTOMER", "MERCHANT"])).resolves.toEqual(["CUSTOMER", "MERCHANT"]);
    await expect(resolveRoleCodes(async () => [] as string[])).rejects.toThrow("SYNTHETIC_ROLES_INVALID");
    await expect(resolveRoleCodes(async () => ["lowercase"])).rejects.toThrow("SYNTHETIC_ROLES_INVALID");
    await expect(resolveRoleCodes(async () => ["CUSTOMER", "CUSTOMER"])).rejects.toThrow("SYNTHETIC_ROLES_INVALID");
    await expect(resolveRoleCodes(async () => 1 as unknown as string[])).rejects.toThrow("SYNTHETIC_ROLES_INVALID");
  });

  test("stores and reads a valid role and high-entropy session token", () => {
    const { storage, values } = createStorage();
    const session = { role: "CUSTOMER", token: "A".repeat(43) };

    storeSyntheticSession(storage, session);

    expect(values.get(SESSION_ROLE_STORAGE_KEY)).toBe(session.role);
    expect(values.get(SESSION_TOKEN_STORAGE_KEY)).toBe(session.token);
    expect(readStoredSyntheticSession(storage)).toEqual(session);
  });

  test("returns no session when both values are absent without clearing storage", () => {
    const { storage, values } = createStorage();

    expect(readStoredSyntheticSession(storage)).toBeNull();
    expect(values.size).toBe(0);
    expect(MOCK_ROLE_STORAGE_KEY).toBe("mockRole");
  });

  test.each([
    ["valid token without role", "A".repeat(43), null],
    ["role without token", null, "CUSTOMER"],
    ["malformed token", "not-a-token", "CUSTOMER"],
    ["malformed role", "A".repeat(43), "customer"],
  ])("clears an invalid stored session (%s)", (_description, token, role) => {
    const { storage, values } = createStorage();
    if (token) values.set(SESSION_TOKEN_STORAGE_KEY, token);
    if (role) values.set(SESSION_ROLE_STORAGE_KEY, role);

    expect(readStoredSyntheticSession(storage)).toBeNull();
    expect(values.has(SESSION_TOKEN_STORAGE_KEY)).toBe(false);
    expect(values.has(SESSION_ROLE_STORAGE_KEY)).toBe(false);
  });

  test("clears both stored session fields explicitly", () => {
    const { storage, values } = createStorage();
    storeSyntheticSession(storage, { role: "CUSTOMER", token: "A".repeat(43) });

    clearStoredSyntheticSession(storage);

    expect(values.size).toBe(0);
  });
});
