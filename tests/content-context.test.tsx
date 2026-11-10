import { render, screen } from "@testing-library/react";
import { ContentContext, useContent } from "@/lib/content-context";
import { contentValue, model } from "./test-utils";

function ContentProbe() {
  const { t } = useContent();
  return <p>{t("brand.name")}</p>;
}

describe("content context", () => {
  test("provides the validated content model and translation function", () => {
    render(
      <ContentContext.Provider value={contentValue()}>
        <ContentProbe />
      </ContentContext.Provider>,
    );

    expect(screen.getByText(model.messages["brand.name"])).toBeInTheDocument();
  });

  test("fails loudly when a component renders outside the provider", () => {
    expect(() => render(<ContentProbe />)).toThrow("CONTENT_PROVIDER_MISSING");
  });
});
