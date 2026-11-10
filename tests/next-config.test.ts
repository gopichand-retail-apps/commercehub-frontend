type FrontendMode = "true" | "false" | undefined;

const originalEnvironment = {
  NEXT_PUBLIC_IS_MOCK: process.env.NEXT_PUBLIC_IS_MOCK,
  COMMERCEHUB_MOCK_API_URL: process.env.COMMERCEHUB_MOCK_API_URL,
  COMMERCEHUB_REAL_API_URL: process.env.COMMERCEHUB_REAL_API_URL,
  COMMERCEHUB_API_URL: process.env.COMMERCEHUB_API_URL,
  COMMERCEHUB_NEXT_DIST_DIR: process.env.COMMERCEHUB_NEXT_DIST_DIR,
};

async function loadNextConfig(mode: FrontendMode, variables: Partial<typeof originalEnvironment> = {}) {
  jest.resetModules();
  for (const key of Object.keys(originalEnvironment) as Array<keyof typeof originalEnvironment>) {
    delete process.env[key];
  }
  if (mode !== undefined) process.env.NEXT_PUBLIC_IS_MOCK = mode;
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) process.env[key] = value;
  }
  return (await import("../next.config")).default;
}

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Next.js API rewrite configuration", () => {
  test("routes mock mode to the configured API origin", async () => {
    const config = await loadNextConfig("true", {
      COMMERCEHUB_MOCK_API_URL: "https://mock-api.example.test",
      COMMERCEHUB_NEXT_DIST_DIR: ".next-test",
    });

    await expect(config.rewrites?.()).resolves.toEqual([
      { source: "/api/:path*", destination: "https://mock-api.example.test/api/:path*" },
    ]);
    expect(config.distDir).toBe(".next-test");
  });

  test("routes live mode to the separate real API origin", async () => {
    const config = await loadNextConfig("false", {
      COMMERCEHUB_MOCK_API_URL: "http://127.0.0.1:1",
      COMMERCEHUB_REAL_API_URL: "https://commerce-api.example.test",
    });

    await expect(config.rewrites?.()).resolves.toEqual([
      { source: "/api/:path*", destination: "https://commerce-api.example.test/api/:path*" },
    ]);
  });

  test("fails closed when the production mock origin is absent", async () => {
    const config = await loadNextConfig(undefined, { COMMERCEHUB_API_URL: "http://127.0.0.1:5302" });
    await expect(config.rewrites?.()).rejects.toThrow("COMMERCEHUB_MOCK_API_URL is required for production mock mode.");
  });
});
