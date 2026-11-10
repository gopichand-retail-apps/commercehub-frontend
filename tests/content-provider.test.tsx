import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { ContentProvider } from "@/components/ContentProvider";
import { useContent, type ContentContextValue } from "@/lib/content-context";
import type { ContentModel } from "@/lib/content-schema";
import { model } from "./test-utils";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

function jsonResponse(payload: unknown, ok = true) {
  return { ok, json: jest.fn().mockResolvedValue(payload) } as unknown as Response;
}

function ContentProbe() {
  const { model: contentModel, t } = useContent();
  return (
    <p>
      {t("meta.title")} — {contentModel.locale}
    </p>
  );
}

describe("content model provider", () => {
  beforeEach(() => {
    document.documentElement.lang = "und";
    document.title = "";
    document.head.innerHTML = "";
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });

  test("fetches with no-store, validates app metadata, and exposes translations", async () => {
    const description = document.createElement("meta");
    description.name = "description";
    document.head.append(description);
    fetchMock.mockResolvedValueOnce(jsonResponse(model));

    render(
      <ContentProvider appId="commercehub" modelUrl="/commercehub-model.json">
        <ContentProbe />
      </ContentProvider>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    await screen.findByText(`${model.messages["meta.title"]} — ${model.locale}`);
    expect(fetchMock).toHaveBeenCalledWith("/commercehub-model.json", expect.objectContaining({ cache: "no-store" }));
    expect(document.documentElement.lang).toBe(model.locale);
    expect(document.title).toBe(model.messages["meta.title"]);
    expect(description.content).toBe(model.messages["meta.description"]);
  });

  test("continues when the document has no description element", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(model));

    render(
      <ContentProvider appId="commercehub" modelUrl="/model.json">
        <ContentProbe />
      </ContentProvider>,
    );

    await screen.findByText(`${model.messages["meta.title"]} — ${model.locale}`);
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });

  test.each([
    ["an HTTP failure", () => jsonResponse(model, false)],
    ["an invalid schema", () => jsonResponse({ ...model, version: 2 })],
    ["a model for another application", () => jsonResponse({ ...model, appId: "another-app" })],
    ["a missing title", () => jsonResponse(withMessages({ "meta.title": "" }))],
    ["a missing description", () => jsonResponse(withMessages({ "meta.description": "" }))],
  ])("shows an alert for %s", async (_reason, response) => {
    fetchMock.mockResolvedValueOnce(response());

    render(
      <ContentProvider appId="commercehub" modelUrl="/model.json">
        <ContentProbe />
      </ContentProvider>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  test("shows an alert when fetching or parsing the model rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));

    render(
      <ContentProvider appId="commercehub" modelUrl="/model.json">
        <ContentProbe />
      </ContentProvider>,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error("invalid JSON")),
    });
    const secondRender = render(
      <ContentProvider appId="commercehub" modelUrl="/model.json">
        <ContentProbe />
      </ContentProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    secondRender.unmount();
  });

  test("does not update state after an in-flight model request is aborted", async () => {
    let rejectFetch: (reason: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFetch = reject;
      }),
    );
    const view = render(
      <ContentProvider appId="commercehub" modelUrl="/model.json">
        <ContentProbe />
      </ContentProvider>,
    );

    view.unmount();
    await act(async () => {
      rejectFetch(new Error("aborted"));
      await Promise.resolve();
    });
  });

  test("translation errors identify missing keys and interpolation values", async () => {
    let exposed: ContentContextValue | undefined;
    function Capture() {
      const value = useContent();
      useEffect(() => {
        exposed = value;
      }, [value]);
      return null;
    }

    fetchMock.mockResolvedValueOnce(jsonResponse(model));
    render(
      <ContentProvider appId="commercehub" modelUrl="/model.json">
        <Capture />
      </ContentProvider>,
    );
    await waitFor(() => expect(exposed).toBeDefined());

    expect(() => exposed?.t("not.a.real.key")).toThrow("CONTENT_KEY_MISSING:not.a.real.key");
    expect(() => exposed?.t("catalog.goodsCount")).toThrow("CONTENT_VALUE_MISSING:count");
    expect(exposed?.t("catalog.goodsCount", { count: 3 })).toBe("3 goods");
  });
});

function withMessages(messages: Record<string, string>): ContentModel {
  return { ...model, messages: { ...model.messages, ...messages } };
}
