import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneyDisplay, DeltaPill, MetricValue } from "./page-shell";

describe("MoneyDisplay", () => {
  it("renders em dash when amount is null or undefined or invalid", () => {
    const { rerender } = render(<MoneyDisplay amount={null} />);
    expect(screen.getByText("—")).toBeDefined();

    rerender(<MoneyDisplay amount={undefined} />);
    expect(screen.getByText("—")).toBeDefined();

    rerender(<MoneyDisplay amount="invalid-number" />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("formats IDR correctly with Rp prefix and no decimals", () => {
    render(<MoneyDisplay amount={1284500000} currency="IDR" />);
    expect(screen.getByText("Rp")).toBeDefined();
    expect(screen.getByText("1.284.500.000")).toBeDefined();
  });

  it("handles Prisma Decimal-like object with toNumber()", () => {
    const mockDecimal = {
      toNumber: () => 75000000,
      toString: () => "75000000",
    };
    render(<MoneyDisplay amount={mockDecimal} currency="IDR" />);
    expect(screen.getByText("75.000.000")).toBeDefined();
  });

  it("formats foreign currency with 2 decimal places and currency suffix", () => {
    render(<MoneyDisplay amount={12500.5} currency="USD" />);
    expect(screen.getByText("12.500,50")).toBeDefined();
    expect(screen.getByText("USD")).toBeDefined();
  });

  it("formats negative amount with minus sign and destructive styling", () => {
    const { container } = render(<MoneyDisplay amount={-350000} currency="IDR" showSign />);
    expect(screen.getByText("-")).toBeDefined();
    expect(screen.getByText("350.000")).toBeDefined();
    expect(container.firstChild).toHaveClass("text-destructive");
  });

  it("shows plus sign and success styling when showSign is true and amount is positive", () => {
    const { container } = render(<MoneyDisplay amount={500000} currency="IDR" showSign />);
    expect(screen.getByText("+")).toBeDefined();
    expect(screen.getByText("500.000")).toBeDefined();
    expect(container.firstChild).toHaveClass("text-success");
  });
});

describe("DeltaPill", () => {
  it("renders em dash for null or non-finite values", () => {
    const { rerender } = render(<DeltaPill value={null} />);
    expect(screen.getByText("—")).toBeDefined();

    rerender(<DeltaPill value={Number.NaN} />);
    expect(screen.getByText("—")).toBeDefined();

    rerender(<DeltaPill value={Number.POSITIVE_INFINITY} />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("renders up trend with comma format and success token, without double plus sign", () => {
    const { container } = render(<DeltaPill value={4.2} />);
    const text = container.textContent;
    expect(text).toContain("4,2%");
    expect(text).not.toContain("+");
    expect(container.firstChild).toHaveClass("text-success");
  });

  it("renders down trend with comma format and destructive token, without double minus", () => {
    const { container } = render(<DeltaPill value={-2.4} />);
    const text = container.textContent;
    expect(text).toContain("2,4%");
    expect(text).not.toContain("-");
    expect(container.firstChild).toHaveClass("text-destructive");
  });

  it("supports goodWhen='down' for cost/lateness metrics", () => {
    const { container } = render(<DeltaPill value={-3.5} goodWhen="down" />);
    // Down is good for inverse metrics -> should be success
    expect(container.firstChild).toHaveClass("text-success");

    const { container: containerUp } = render(<DeltaPill value={3.5} goodWhen="down" />);
    // Up is bad for inverse metrics -> should be destructive
    expect(containerUp.firstChild).toHaveClass("text-destructive");
  });

  it("renders flat state when value is below noise threshold", () => {
    const { container } = render(<DeltaPill value={0} />);
    expect(container.textContent).toContain("0,0%");
    expect(container.firstChild).toHaveClass("text-muted-foreground");
  });
});

describe("MetricValue", () => {
  it("renders prefix, value and suffix in tabular font", () => {
    render(
      <MetricValue prefix="Rp" suffix="/bln">
        15.000.000
      </MetricValue>
    );
    expect(screen.getByText("Rp")).toBeDefined();
    expect(screen.getByText("15.000.000")).toBeDefined();
    expect(screen.getByText("/bln")).toBeDefined();
  });
});
