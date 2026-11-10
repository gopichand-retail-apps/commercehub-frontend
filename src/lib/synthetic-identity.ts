export const MOCK_ROLE_STORAGE_KEY = "mockRole";
export const SESSION_TOKEN_STORAGE_KEY = "syntheticSessionToken";
export const SESSION_ROLE_STORAGE_KEY = "syntheticSessionRole";

const roleCodePattern = /^[A-Z][A-Z_]{0,31}$/;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export interface SessionStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredSyntheticSession {
  role: string;
  token: string;
}

export async function resolveRoleCodes(fetchServerRoles: () => Promise<string[]>): Promise<string[]> {
  return validateRoleCodes(await fetchServerRoles());
}

export function readStoredSyntheticSession(storage: SessionStoragePort): StoredSyntheticSession | null {
  const token = storage.getItem(SESSION_TOKEN_STORAGE_KEY);
  const role = storage.getItem(SESSION_ROLE_STORAGE_KEY);
  if (!token && !role) return null;
  if (token && role && sessionTokenPattern.test(token) && roleCodePattern.test(role)) {
    return { role, token };
  }
  clearStoredSyntheticSession(storage);
  return null;
}

export function storeSyntheticSession(storage: SessionStoragePort, session: StoredSyntheticSession): void {
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, session.token);
  storage.setItem(SESSION_ROLE_STORAGE_KEY, session.role);
}

export function clearStoredSyntheticSession(storage: SessionStoragePort): void {
  storage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  storage.removeItem(SESSION_ROLE_STORAGE_KEY);
}

function validateRoleCodes(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((role): role is string => typeof role === "string" && roleCodePattern.test(role)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error("SYNTHETIC_ROLES_INVALID");
  }
  return value;
}
