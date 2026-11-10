import { fireEvent, screen } from "@testing-library/react";
import { CartPanel } from "@/components/CartPanel";
import { CatalogSection } from "@/components/CatalogSection";
import { CheckoutDialog, ProductDialog, ReceiptDialog } from "@/components/CommerceDialogs";
import { ProductCard } from "@/components/ProductCard";
import { StoreDialog } from "@/components/StoreDialog";
import {
  DemoPolicy,
  DemoRibbon,
  HeroBand,
  ShippingRibbon,
  SiteHeader,
  StoreApproach,
  StoreFooter,
} from "@/components/StoreSections";
import { SyntheticIdentityPanel } from "@/components/SyntheticIdentityPanel";
import { dataStringAt } from "@/lib/content-schema";
import { model, products, quote, receipt, renderWithContent, translate } from "./test-utils";

describe("storefront product and catalog components", () => {
  test("renders localized product data and supports detail and add actions", () => {
    const onAdd = jest.fn();
    const onView = jest.fn();
    const product = products[0];

    renderWithContent(<ProductCard product={product} onAdd={onAdd} onView={onView} />);

    expect(screen.getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(screen.getByText("$18.00")).toBeInTheDocument();
    expect(screen.getByText(translate("product.storeFavorite"))).toBeInTheDocument();
    expect(screen.getByText(translate("product.inStock"))).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: dataStringAt(model, "products", product.slug, "imageAlt") }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: translate("product.viewDetails", { name: product.name }) }));
    fireEvent.click(screen.getByRole("button", { name: translate("product.addToBag", { name: product.name }) }));

    expect(onView).toHaveBeenCalledWith(product);
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  test("marks low stock and prevents adding an unavailable item", () => {
    const onAdd = jest.fn();
    const product = products[3];

    renderWithContent(<ProductCard product={product} onAdd={onAdd} onView={jest.fn()} />);

    expect(screen.getByText(translate("product.fewLeft"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translate("product.addToBag", { name: product.name }) })).toBeDisabled();
    expect(screen.queryByText(translate("product.storeFavorite"))).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", dataStringAt(model, "products", product.slug, "imageAlt"));
  });

  test("renders loading and error catalog states with retry behavior", () => {
    const onRetry = jest.fn();
    const commonProps = {
      visibleProducts: [],
      categories: [{ id: "ALL", label: translate("catalog.allGoods") }],
      activeCategory: "ALL",
      query: "",
      sortOrder: "featured",
      catalogError: "",
      quoteUpdating: false,
      onCategoryChange: jest.fn(),
      onQueryChange: jest.fn(),
      onClearQuery: jest.fn(),
      onSortChange: jest.fn(),
      onRetry,
      onResetFilters: jest.fn(),
      onAdd: jest.fn(),
      onView: jest.fn(),
    };

    const { rerender } = renderWithContent(<CatalogSection {...commonProps} catalogState="loading" />);
    expect(screen.getByRole("region", { name: translate("catalog.title") })).toBeInTheDocument();
    expect(screen.getByLabelText(translate("catalog.loading"))).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".product-skeleton")).toHaveLength(6);

    rerender(
      <CatalogSection {...commonProps} catalogState="error" catalogError={translate("errors.PRODUCT_NOT_FOUND")} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(translate("errors.PRODUCT_NOT_FOUND"));
    fireEvent.click(screen.getByRole("button", { name: translate("catalog.tryAgain") }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<CatalogSection {...commonProps} catalogState="error" catalogError="" />);
    expect(screen.getByRole("alert")).toHaveTextContent(translate("errors.requestFailed"));
  });

  test("supports catalog filtering controls, empty recovery, and ready products", () => {
    const onCategoryChange = jest.fn();
    const onClearQuery = jest.fn();
    const onQueryChange = jest.fn();
    const onResetFilters = jest.fn();
    const onSortChange = jest.fn();
    const onAdd = jest.fn();
    const onView = jest.fn();
    const commonProps = {
      categories: [
        { id: "ALL", label: translate("catalog.allGoods") },
        { id: "Pantry", label: dataStringAt(model, "products", products[0].slug, "category") },
      ],
      activeCategory: "ALL",
      query: "coffee",
      sortOrder: "featured",
      catalogState: "ready" as const,
      catalogError: "",
      quoteUpdating: true,
      onCategoryChange,
      onQueryChange,
      onClearQuery,
      onSortChange,
      onRetry: jest.fn(),
      onResetFilters,
      onAdd,
      onView,
    };

    const { rerender } = renderWithContent(<CatalogSection {...commonProps} visibleProducts={[products[0]]} />);

    expect(screen.getByText(translate("catalog.goodsCount", { count: "1" }))).toBeInTheDocument();
    expect(screen.getByText(translate("catalog.quoteUpdating"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translate("catalog.allGoods") })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", {
        name: dataStringAt(model, "products", products[0].slug, "category"),
      }),
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "coffee beans" } });
    fireEvent.click(screen.getByRole("button", { name: translate("catalog.clearSearch") }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "price-low" } });
    expect(onCategoryChange).toHaveBeenCalledWith("Pantry");
    expect(onQueryChange).toHaveBeenCalledWith("coffee beans");
    expect(onClearQuery).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith("price-low");

    rerender(<CatalogSection {...commonProps} query="" visibleProducts={[]} quoteUpdating={false} />);
    expect(screen.getByText(translate("catalog.emptyTitle"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: translate("catalog.showAll") }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  test("eager-loads the first catalog row and lazy-loads later product images", () => {
    renderWithContent(
      <CatalogSection
        visibleProducts={[products[0], products[1], products[2], products[3]]}
        categories={[{ id: "ALL", label: translate("catalog.allGoods") }]}
        activeCategory="ALL"
        query=""
        sortOrder="featured"
        catalogState="ready"
        catalogError=""
        quoteUpdating={false}
        onCategoryChange={jest.fn()}
        onQueryChange={jest.fn()}
        onClearQuery={jest.fn()}
        onSortChange={jest.fn()}
        onRetry={jest.fn()}
        onResetFilters={jest.fn()}
        onAdd={jest.fn()}
        onView={jest.fn()}
      />,
    );

    const images = Array.from(document.querySelectorAll(".product-card .product-image"));
    expect(images).toHaveLength(4);
    for (const image of images.slice(0, 3)) {
      expect(image).toHaveAttribute("loading", "eager");
    }
    expect(images[3]).toHaveAttribute("loading", "lazy");
  });
});

describe("storefront cart and dialogs", () => {
  test("renders an empty cart and disables checkout until a quote and identity are ready", () => {
    const onCheckout = jest.fn();
    renderWithContent(
      <CartPanel
        lines={[]}
        quote={null}
        quoteState="idle"
        quoteError=""
        promoCode=""
        promoDraft=""
        isCheckoutPending={false}
        latestOrder={false}
        canCheckout={false}
        mobileOpen
        onQuantityChange={jest.fn()}
        onPromoDraftChange={jest.fn()}
        onApplyPromo={jest.fn()}
        onClearPromo={jest.fn()}
        onCheckout={onCheckout}
        onViewOrder={jest.fn()}
        onCloseMobile={jest.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: translate("cart.emptyTitle") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: translate("cart.browse") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(translate("cart.checkout")) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: translate("cart.latestOrderAction") })).not.toBeInTheDocument();
  });

  test("updates cart quantities, applies and removes a promo, and displays a ready quote", () => {
    const onApplyPromo = jest.fn();
    const onCheckout = jest.fn();
    const onClearPromo = jest.fn();
    const onCloseMobile = jest.fn();
    const onQuantityChange = jest.fn();
    const onPromoDraftChange = jest.fn();
    const onViewOrder = jest.fn();
    const discountedQuote = {
      ...quote,
      lines: [{ ...quote.lines[0], discountMinor: 180, totalMinor: 1620 }],
      discountMinor: 180,
      shippingMinor: 0,
      totalMinor: 1620,
    };
    const promo = "HELLO10";

    const { rerender } = renderWithContent(
      <CartPanel
        lines={[{ product: products[0], quantity: 24 }]}
        quote={discountedQuote}
        quoteState="ready"
        quoteError=""
        promoCode={promo}
        promoDraft={promo}
        isCheckoutPending={false}
        latestOrder
        canCheckout
        mobileOpen
        onQuantityChange={onQuantityChange}
        onPromoDraftChange={onPromoDraftChange}
        onApplyPromo={onApplyPromo}
        onClearPromo={onClearPromo}
        onCheckout={onCheckout}
        onViewOrder={onViewOrder}
        onCloseMobile={onCloseMobile}
      />,
    );

    expect(screen.getByText(translate("cart.promoApplied", { code: promo }))).toBeInTheDocument();
    expect(screen.getByText(translate("cart.complimentary"))).toBeInTheDocument();
    expect(screen.getByText(/1\.80/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translate("cart.addOne", { name: products[0].name }) })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: translate("cart.removeOne", { name: products[0].name }) }));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.removeItem", { name: products[0].name }) }));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.latestOrderAction") }));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.closeBag") }));
    fireEvent.click(screen.getByRole("button", { name: translate("cart.removePromo") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(translate("cart.checkout")) }));
    expect(onQuantityChange).toHaveBeenNthCalledWith(1, products[0].id, 23);
    expect(onQuantityChange).toHaveBeenNthCalledWith(2, products[0].id, 0);
    expect(onViewOrder).toHaveBeenCalledTimes(1);
    expect(onCloseMobile).toHaveBeenCalledTimes(1);
    expect(onClearPromo).toHaveBeenCalledTimes(1);
    expect(onCheckout).toHaveBeenCalledTimes(1);

    rerender(
      <CartPanel
        lines={[{ product: products[0], quantity: 1 }]}
        quote={quote}
        quoteState="loading"
        quoteError=""
        promoCode=""
        promoDraft=""
        isCheckoutPending
        latestOrder={false}
        canCheckout
        mobileOpen
        onQuantityChange={onQuantityChange}
        onPromoDraftChange={onPromoDraftChange}
        onApplyPromo={onApplyPromo}
        onClearPromo={onClearPromo}
        onCheckout={onCheckout}
        onViewOrder={onViewOrder}
        onCloseMobile={onCloseMobile}
      />,
    );
    expect(screen.getByText(translate("cart.refreshingQuote"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(translate("cart.checkoutPending")) })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(new RegExp(translate("cart.promoLabel"))), {
      target: { value: "HELLO10" },
    });
    expect(onPromoDraftChange).toHaveBeenCalledWith("HELLO10");
    expect(onApplyPromo).not.toHaveBeenCalled();
  });

  test("shows quote errors and uses a generic message when no server error is provided", () => {
    renderWithContent(
      <CartPanel
        lines={[{ product: products[0], quantity: 1 }]}
        quote={null}
        quoteState="error"
        quoteError=""
        promoCode=""
        promoDraft=""
        isCheckoutPending={false}
        latestOrder={false}
        canCheckout
        mobileOpen
        onQuantityChange={jest.fn()}
        onPromoDraftChange={jest.fn()}
        onApplyPromo={jest.fn()}
        onClearPromo={jest.fn()}
        onCheckout={jest.fn()}
        onViewOrder={jest.fn()}
        onCloseMobile={jest.fn()}
      />,
    );

    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(translate("errors.requestFailed"));
    expect(screen.getByRole("button", { name: translate("cart.applyPromo") })).toBeDisabled();
  });

  test("opens product details and handles close, add, stock, checkout, and receipt states", () => {
    const onAdd = jest.fn();
    const onClose = jest.fn();
    const { rerender } = renderWithContent(<ProductDialog product={products[0]} onClose={onClose} onAdd={onAdd} />);
    expect(screen.getByRole("heading", { name: products[0].name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: translate("dialog.addToBag") }));
    fireEvent.click(screen.getByRole("button", { name: translate("dialog.closeProduct") }));
    expect(onAdd).toHaveBeenCalledWith(products[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ProductDialog product={products[3]} onClose={onClose} onAdd={onAdd} />);
    expect(screen.getByRole("button", { name: translate("dialog.addToBag") })).toBeDisabled();

    const onPlaceOrder = jest.fn();
    rerender(
      <CheckoutDialog
        open
        quote={{ ...quote, discountMinor: 180, shippingMinor: 0 }}
        error={translate("errors.requestFailed")}
        pending={false}
        onClose={onClose}
        onPlaceOrder={onPlaceOrder}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(translate("errors.requestFailed"));
    expect(screen.getByText(translate("checkout.receiptDiscount"))).toBeInTheDocument();
    expect(screen.getAllByText(translate("cart.complimentary"))).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: translate("checkout.placeOrder") }));
    expect(onPlaceOrder).toHaveBeenCalledTimes(1);

    rerender(<CheckoutDialog open quote={null} error="" pending onClose={onClose} onPlaceOrder={onPlaceOrder} />);
    expect(screen.getByRole("button", { name: translate("checkout.pending") })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("renders order receipts with loading, error, and dismiss states", () => {
    const onClose = jest.fn();
    const { rerender } = renderWithContent(
      <ReceiptDialog open receipt={receipt} loading error="Order lookup failed." onClose={onClose} />,
    );

    expect(screen.getByRole("heading", { name: translate("receipt.title") })).toBeInTheDocument();
    expect(screen.getByText(receipt.orderId.slice(0, 8).toUpperCase())).toBeInTheDocument();
    expect(screen.getByText(translate("receipt.loading"))).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Order lookup failed.");
    fireEvent.click(screen.getByRole("button", { name: translate("receipt.backToShop") }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ReceiptDialog open receipt={null} loading={false} error="" onClose={onClose} />);
    expect(screen.queryByRole("heading", { name: translate("receipt.title") })).not.toBeInTheDocument();
  });

  test("supports native dialog close, cancel, and backdrop behavior", () => {
    const onClose = jest.fn();
    const { rerender } = renderWithContent(
      <StoreDialog open labelledBy="dialog-heading" onClose={onClose}>
        <h2 id="dialog-heading">{translate("checkout.title")}</h2>
        <button type="button">Inside</button>
      </StoreDialog>,
    );
    const dialog = screen.getByRole("dialog", { name: translate("checkout.title") });

    expect(dialog).toHaveClass("store-dialog");
    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <StoreDialog open={false} labelledBy="dialog-heading" onClose={onClose}>
        <h2 id="dialog-heading">{translate("checkout.title")}</h2>
      </StoreDialog>,
    );
    expect(dialog).not.toHaveAttribute("open");
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("storefront shared sections and identity panel", () => {
  test("renders all content-model sections and site header actions", () => {
    const onOpenBag = jest.fn();
    const onViewLatestOrder = jest.fn();
    const { rerender } = renderWithContent(
      <>
        <DemoRibbon />
        <SiteHeader itemCount={2} hasLatestOrder onOpenBag={onOpenBag} onViewLatestOrder={onViewLatestOrder} />
        <HeroBand />
        <ShippingRibbon />
        <StoreApproach />
        <DemoPolicy />
        <StoreFooter />
      </>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(translate("hero.titleLead"));
    expect(
      screen.getByRole("img", {
        name: dataStringAt(model, "products", "everyday-daypack", "imageAlt"),
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: translate("header.navigation") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translate("header.bagCount", { count: "2" }) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: new RegExp(translate("approach.titleLead")) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: translate("policy.title") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(translate("footer.imageLicense")) })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
    fireEvent.click(screen.getByRole("button", { name: translate("header.latestOrder") }));
    fireEvent.click(screen.getByRole("button", { name: translate("header.bagCount", { count: "2" }) }));
    expect(onViewLatestOrder).toHaveBeenCalledTimes(1);
    expect(onOpenBag).toHaveBeenCalledTimes(1);

    rerender(
      <SiteHeader itemCount={0} hasLatestOrder={false} onOpenBag={onOpenBag} onViewLatestOrder={onViewLatestOrder} />,
    );
    expect(screen.queryByRole("button", { name: translate("header.latestOrder") })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: translate("header.bagCount", { count: "0" }) })).toBeInTheDocument();
  });

  test("shows identity loading, role restrictions, server errors, and revocation warnings", () => {
    const onSelectRole = jest.fn();
    const props = {
      mode: "server" as const,
      roleCodes: ["CUSTOMER", "MERCHANT"],
      selectedRoleCode: "MERCHANT",
      checkoutRoleCode: "CUSTOMER",
      error: translate("errors.requestFailed"),
      revocationWarning: true,
      onSelectRole,
    };
    const { rerender } = renderWithContent(<SyntheticIdentityPanel {...props} status="loading" />);

    expect(screen.getByRole("status")).toHaveTextContent(translate("identity.loading"));
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByText(translate("identity.modeServer"))).toBeInTheDocument();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(translate("errors.requestFailed"));
    expect(document.querySelector(".identity-panel-description")).toBeNull();
    expect(Object.hasOwn(model.messages, "identity.mockDescription")).toBe(false);
    expect(Object.hasOwn(model.messages, "identity.serverDescription")).toBe(false);

    rerender(<SyntheticIdentityPanel {...props} status="ready" />);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(translate("identity.customerOnly"));
    expect(screen.getByText(translate("identity.sessionReady"))).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "CUSTOMER" } });
    expect(onSelectRole).toHaveBeenCalledWith("CUSTOMER");

    rerender(
      <SyntheticIdentityPanel
        {...props}
        status="ready"
        selectedRoleCode="CUSTOMER"
        error=""
        revocationWarning={false}
      />,
    );
    expect(screen.queryByText(translate("identity.customerOnly"))).not.toBeInTheDocument();
    expect(screen.getByText(translate("identity.modeServer"))).toBeInTheDocument();

    rerender(<SyntheticIdentityPanel {...props} status="expired" error="" revocationWarning={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(translate("identity.sessionExpired"));
    fireEvent.click(screen.getByRole("button", { name: translate("identity.reauthenticate") }));
    expect(onSelectRole).toHaveBeenLastCalledWith("MERCHANT");
  });
});
