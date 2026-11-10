import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
  clearMocks: true,
  collectCoverageFrom: [
    "next.config.ts",
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.test.{js,jsx,ts,tsx}",
    "!src/**/*.spec.{js,jsx,ts,tsx}",
    "!src/**/__tests__/**/*.{js,jsx,ts,tsx}",
  ],
  coverageProvider: "v8",
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "src/hooks/useSyntheticIdentity.ts": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "src/lib/commerce-api.ts": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "src/lib/config.ts": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.[jt]s?(x)"],
});
