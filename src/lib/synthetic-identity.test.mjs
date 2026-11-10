import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_IS_MOCK, parseIsMockValue, resolveCommerceHubApiOrigin } from "./config.ts";
import { resolveRoleCodes } from "./synthetic-identity.ts";

test("isMock defaults to true and accepts only exact build-time overrides", () => {
  assert.equal(DEFAULT_IS_MOCK, true);
  assert.equal(parseIsMockValue(undefined), true);
  assert.equal(parseIsMockValue("true"), true);
  assert.equal(parseIsMockValue("false"), false);
  assert.throws(() => parseIsMockValue("yes"), /NEXT_PUBLIC_IS_MOCK/);
});

test("role choices always come from the API, including mock mode", async () => {
  let serverRoleRequests = 0;
  const roles = await resolveRoleCodes(async () => {
    serverRoleRequests += 1;
    return ["CUSTOMER", "MERCHANT", "SUPPORT"];
  });

  assert.deepEqual(roles, ["CUSTOMER", "MERCHANT", "SUPPORT"]);
  assert.equal(serverRoleRequests, 1);
});

test("API role responses reject unknown, duplicate, or empty roles", async () => {
  await assert.rejects(
    resolveRoleCodes(async () => ["unknown"]),
    /SYNTHETIC_ROLES_INVALID/,
  );
  await assert.rejects(
    resolveRoleCodes(async () => ["CUSTOMER", "CUSTOMER"]),
    /SYNTHETIC_ROLES_INVALID/,
  );
  await assert.rejects(
    resolveRoleCodes(async () => []),
    /SYNTHETIC_ROLES_INVALID/,
  );
});

test("mock and live modes select separate API origins and fail closed", () => {
  assert.equal(
    resolveCommerceHubApiOrigin({
      isMock: true,
      mockApiOrigin: "http://127.0.0.1:5304",
      realApiOrigin: "http://127.0.0.1:1",
      isDevelopment: false,
    }),
    "http://127.0.0.1:5304",
  );
  assert.equal(
    resolveCommerceHubApiOrigin({
      isMock: false,
      mockApiOrigin: "http://127.0.0.1:1",
      realApiOrigin: "http://127.0.0.1:5304",
      isDevelopment: true,
    }),
    "http://127.0.0.1:5304",
  );
  assert.throws(() => resolveCommerceHubApiOrigin({ isMock: true, isDevelopment: false }), /COMMERCEHUB_MOCK_API_URL/);
  assert.throws(() => resolveCommerceHubApiOrigin({ isMock: false, isDevelopment: true }), /COMMERCEHUB_REAL_API_URL/);
  assert.throws(
    () =>
      resolveCommerceHubApiOrigin({
        isMock: true,
        mockApiOrigin: "https://mock.example.test/api/v1",
        isDevelopment: false,
      }),
    /HTTP\(S\) origin/,
  );
});
