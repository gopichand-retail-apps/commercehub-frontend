import {
  contentModelSchema,
  dataString,
  dataStringArray,
  dataStringAt,
  dataStringFrom,
  dataStringOr,
  dataStringRecord,
  errorMessage,
} from "@/lib/content-schema";
import { contentValue, model, translate } from "./test-utils";

describe("validated content model helpers", () => {
  test("strictly validates the public model shape", () => {
    expect(contentModelSchema.safeParse(model).success).toBe(true);
    expect(
      contentModelSchema.safeParse({
        ...model,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(contentModelSchema.safeParse({ ...model, version: 2 }).success).toBe(false);
  });

  test("reads string values, records, arrays, nested values, and defaults", () => {
    expect(dataString(model, "currency.code")).toBe("USD");
    expect(dataStringRecord(model, "categoryNames").Pantry).toBeTruthy();
    expect(dataStringArray(model, "categoryOrder")).toContain("Travel");
    expect(dataStringFrom(model, "categoryNames", "Home")).toBe("Home");
    expect(dataStringAt(model, "products", "daybreak-coffee", "name")).toBe("Daybreak Coffee");
    expect(dataStringOr(model, "categoryNames", "missing", "fallback")).toBe("fallback");
    expect(dataStringOr(model, "categoryNames", "Home", "fallback")).toBe("Home");
  });

  test("fails closed for missing or wrongly typed content values", () => {
    const malformedModel = {
      ...model,
      data: {
        ...model.data,
        categoryNames: "invalid",
        products: { "invalid-product": "invalid" },
      },
    };
    expect(() => dataString(model, "categoryOrder")).toThrow("CONTENT_DATA_INVALID:categoryOrder");
    expect(() => dataStringRecord(model, "categoryOrder")).toThrow("CONTENT_DATA_INVALID:categoryOrder");
    expect(() => dataStringArray(model, "categoryNames")).toThrow("CONTENT_DATA_INVALID:categoryNames");
    expect(() => dataStringFrom(model, "categoryNames", "missing")).toThrow(
      "CONTENT_DATA_INVALID:categoryNames.missing",
    );
    expect(() => dataStringAt(model, "products", "missing", "name")).toThrow(
      "CONTENT_DATA_INVALID:products.missing.name",
    );
    expect(() => dataStringAt(model, "products", "daybreak-coffee", "missing")).toThrow(
      "CONTENT_DATA_INVALID:products.daybreak-coffee.missing",
    );
    expect(() => dataStringFrom(malformedModel, "categoryNames", "Home")).toThrow(
      "CONTENT_DATA_INVALID:categoryNames.Home",
    );
    expect(() => dataStringAt(malformedModel, "products", "invalid-product", "name")).toThrow(
      "CONTENT_DATA_INVALID:products.invalid-product.name",
    );
    expect(() => dataStringOr(model, "currency.code", "Home", "fallback")).toThrow(
      "CONTENT_DATA_INVALID:currency.code",
    );
    expect(() => dataStringOr(malformedModel, "categoryNames", "Home", "fallback")).toThrow(
      "CONTENT_DATA_INVALID:categoryNames",
    );
    expect(() =>
      dataStringOr(
        { ...model, data: { ...model.data, categoryNames: { Home: 1 } } },
        "categoryNames",
        "Home",
        "fallback",
      ),
    ).toThrow("CONTENT_DATA_INVALID:categoryNames.Home");
  });

  test("maps error codes only when the content model has a matching message", () => {
    const translateSpy = jest.fn(translate);
    expect(errorMessage(model, translateSpy, { code: "PROMO_CODE_INVALID" })).toBe(
      model.messages["errors.PROMO_CODE_INVALID"],
    );
    expect(errorMessage(model, translateSpy, { code: "UNMAPPED" })).toBe(translate("errors.requestFailed"));
    expect(errorMessage(model, translateSpy, new Error("failure"))).toBe(translate("errors.requestFailed"));
    expect(errorMessage(model, translateSpy, { code: 4 })).toBe(translate("errors.requestFailed"));
    expect(contentValue().model).toBe(model);
  });
});
