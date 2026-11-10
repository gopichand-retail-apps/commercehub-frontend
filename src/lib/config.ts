const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const DEFAULT_IS_MOCK = true;

export function parseIsMockValue(value: string | undefined): boolean {
  if (value === undefined) return DEFAULT_IS_MOCK;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error('NEXT_PUBLIC_IS_MOCK must be exactly "true" or "false".');
}

export const isMock = parseIsMockValue(process.env.NEXT_PUBLIC_IS_MOCK);

interface ApiOriginConfiguration {
  isMock: boolean;
  mockApiOrigin?: string;
  realApiOrigin?: string;
  legacyApiOrigin?: string;
  isDevelopment: boolean;
}

export function resolveCommerceHubApiOrigin({
  isMock: useMockApi,
  mockApiOrigin,
  realApiOrigin,
  legacyApiOrigin,
  isDevelopment,
}: ApiOriginConfiguration): string {
  const configuredMockApiOrigin = mockApiOrigin?.trim();
  let selectedApiOrigin: string | undefined;
  let localMockFallback = false;

  if (useMockApi) {
    selectedApiOrigin = configuredMockApiOrigin;
    if (!selectedApiOrigin && isDevelopment) {
      selectedApiOrigin = legacyApiOrigin?.trim() || "http://127.0.0.1:5302";
      localMockFallback = true;
    }
    if (!selectedApiOrigin) {
      throw new Error("COMMERCEHUB_MOCK_API_URL is required for production mock mode.");
    }
  } else {
    selectedApiOrigin = realApiOrigin?.trim();
    if (!selectedApiOrigin) {
      throw new Error("COMMERCEHUB_REAL_API_URL is required when NEXT_PUBLIC_IS_MOCK=false.");
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(selectedApiOrigin);
  } catch {
    throw new Error("The selected CommerceHub API must be an absolute HTTP(S) origin.");
  }

  if (
    (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("The selected CommerceHub API must be an HTTP(S) origin without credentials or a path.");
  }

  if (localMockFallback && !LOOPBACK_HOSTS.has(parsedUrl.hostname)) {
    throw new Error("Local mock mode may only fall back to a loopback API.");
  }
  if (!isDevelopment && !LOOPBACK_HOSTS.has(parsedUrl.hostname) && parsedUrl.protocol !== "https:") {
    throw new Error("Production CommerceHub API origins must use HTTPS.");
  }

  return parsedUrl.origin;
}
