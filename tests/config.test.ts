import { DEFAULT_IS_MOCK, isMock, parseIsMockValue, resolveCommerceHubApiOrigin } from "@/lib/config";

describe("frontend data-mode configuration", () => {
  test("accepts only exact mock-mode values and defaults to mock", () => {
    expect(DEFAULT_IS_MOCK).toBe(true);
    expect(parseIsMockValue(undefined)).toBe(true);
    expect(parseIsMockValue("true")).toBe(true);
    expect(parseIsMockValue("false")).toBe(false);
    expect(isMock).toBe(parseIsMockValue(process.env.NEXT_PUBLIC_IS_MOCK));
    expect(() => parseIsMockValue("TRUE")).toThrow('NEXT_PUBLIC_IS_MOCK must be exactly "true" or "false".');
  });

  test("selects the configured mock API and development loopback fallbacks", () => {
    expect(
      resolveCommerceHubApiOrigin({
        isMock: true,
        mockApiOrigin: " https://mock.example.test ",
        realApiOrigin: "http://127.0.0.1:5304",
        isDevelopment: false,
      }),
    ).toBe("https://mock.example.test");
    expect(
      resolveCommerceHubApiOrigin({
        isMock: true,
        legacyApiOrigin: " http://127.0.0.1:5304 ",
        isDevelopment: true,
      }),
    ).toBe("http://127.0.0.1:5304");
    expect(
      resolveCommerceHubApiOrigin({
        isMock: true,
        isDevelopment: true,
      }),
    ).toBe("http://127.0.0.1:5302");
  });

  test("requires a configured API origin in production and live mode", () => {
    expect(() => resolveCommerceHubApiOrigin({ isMock: true, isDevelopment: false })).toThrow(
      "COMMERCEHUB_MOCK_API_URL is required for production mock mode.",
    );
    expect(() => resolveCommerceHubApiOrigin({ isMock: false, isDevelopment: true })).toThrow(
      "COMMERCEHUB_REAL_API_URL is required when NEXT_PUBLIC_IS_MOCK=false.",
    );
    expect(() =>
      resolveCommerceHubApiOrigin({
        isMock: true,
        legacyApiOrigin: "https://not-local.example.test",
        isDevelopment: true,
      }),
    ).toThrow("Local mock mode may only fall back to a loopback API.");
  });

  test.each([
    ["not a URL", "The selected CommerceHub API must be an absolute HTTP(S) origin."],
    ["ftp://api.example.test", "The selected CommerceHub API must be an HTTP(S) origin without credentials or a path."],
    [
      "https://api.example.test/v1",
      "The selected CommerceHub API must be an HTTP(S) origin without credentials or a path.",
    ],
    [
      "https://api.example.test/?q=1",
      "The selected CommerceHub API must be an HTTP(S) origin without credentials or a path.",
    ],
    [
      "https://api.example.test/#fragment",
      "The selected CommerceHub API must be an HTTP(S) origin without credentials or a path.",
    ],
    [
      "https://user@api.example.test",
      "The selected CommerceHub API must be an HTTP(S) origin without credentials or a path.",
    ],
    [
      "https://user:pass@api.example.test",
      "The selected CommerceHub API must be an HTTP(S) origin without credentials or a path.",
    ],
  ])("rejects invalid API origin %s", (origin, message) => {
    expect(() =>
      resolveCommerceHubApiOrigin({
        isMock: false,
        realApiOrigin: origin,
        isDevelopment: true,
      }),
    ).toThrow(message);
  });

  test("requires HTTPS for non-loopback production APIs but permits local HTTP", () => {
    expect(() =>
      resolveCommerceHubApiOrigin({
        isMock: false,
        realApiOrigin: "http://api.example.test",
        isDevelopment: false,
      }),
    ).toThrow("Production CommerceHub API origins must use HTTPS.");
    expect(
      resolveCommerceHubApiOrigin({
        isMock: false,
        realApiOrigin: "https://api.example.test",
        isDevelopment: false,
      }),
    ).toBe("https://api.example.test");
    expect(
      resolveCommerceHubApiOrigin({
        isMock: false,
        realApiOrigin: "http://localhost:5302",
        isDevelopment: false,
      }),
    ).toBe("http://localhost:5302");
    expect(
      resolveCommerceHubApiOrigin({
        isMock: false,
        realApiOrigin: "http://[::1]:5302",
        isDevelopment: true,
      }),
    ).toBe("http://[::1]:5302");
  });
});
