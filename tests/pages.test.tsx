import PrivacyPage from "@/app/privacy/page";
import Home from "@/app/page";
import RootLayout, { metadata } from "@/app/layout";
import { CommerceStore } from "@/components/CommerceStore";
import { renderWithContent, translate } from "./test-utils";

jest.mock("@fontsource-variable/roboto/wght.css", () => ({}));
jest.mock("@fontsource-variable/roboto-slab/wght.css", () => ({}));

describe("Next.js storefront routes", () => {
  test("connects the home route to the storefront and provides the shared content model", () => {
    const home = Home();
    expect(home.type).toBe(CommerceStore);

    const layout = RootLayout({ children: <span>{translate("brand.name")}</span> });
    expect(layout.type).toBe("html");
    expect(layout.props.lang).toBe("und");
    expect(layout.props.children.type).toBe("body");
    expect(layout.props.children.props.children.type).toBeDefined();
    expect(layout.props.children.props.children.props.appId).toBe("commercehub");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test("renders the privacy route using localized model copy", () => {
    renderWithContent(<PrivacyPage />);

    expect(document.querySelector("h1")).toHaveTextContent(translate("privacy.title"));
    expect(document.querySelectorAll("li")).toHaveLength(4);
    expect(document.querySelector("a[href='/']")).toBeInTheDocument();
  });
});
