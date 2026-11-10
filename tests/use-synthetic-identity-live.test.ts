test("reports the server mode when the frontend is built for the live API", async () => {
  const previousMode = process.env.NEXT_PUBLIC_IS_MOCK;
  process.env.NEXT_PUBLIC_IS_MOCK = "false";
  jest.resetModules();

  let unmount: (() => void) | undefined;
  try {
    const [testingLibrary, identityModule, apiModule, schemaModule, modelModule] = await Promise.all([
      import("@testing-library/react/pure"),
      import("@/hooks/useSyntheticIdentity"),
      import("@/lib/commerce-api"),
      import("@/lib/content-schema"),
      import("../public/commercehub-model.json"),
    ]);
    const model = schemaModule.contentModelSchema.parse(modelModule.default);
    const session = {
      id: "80a6da1d-80e9-4ad0-9b05-a090ff3c4c57",
      role: "CUSTOMER",
      token: "A".repeat(43),
      expiresAt: "2030-01-01T00:00:00.000Z",
    };
    window.sessionStorage.clear();
    jest.spyOn(apiModule.commerceApi, "syntheticRoles").mockResolvedValue({ roles: ["CUSTOMER"] });
    jest.spyOn(apiModule.commerceApi, "createSyntheticSession").mockResolvedValue(session);

    const view = testingLibrary.renderHook(() => identityModule.useSyntheticIdentity(model));
    unmount = view.unmount;
    await testingLibrary.waitFor(() => expect(view.result.current.status).toBe("ready"));

    expect(view.result.current.mode).toBe("server");
    expect(view.result.current.isMock).toBe(false);
  } finally {
    unmount?.();
    jest.restoreAllMocks();
    jest.resetModules();
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_IS_MOCK;
    else process.env.NEXT_PUBLIC_IS_MOCK = previousMode;
  }
});
