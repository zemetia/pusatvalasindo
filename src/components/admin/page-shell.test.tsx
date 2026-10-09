import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneyDisplay, DeltaPill, MetricValue, MetricBlock, MetricRow } from "./page-shell";

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

describe("MetricBlock", () => {
  it("renders label, value, meta, and action", () => {
    render(
      <MetricBlock
        label="Total Omzet"
        value="1.500.000"
        meta="dari target 2.000.000"
        action={<button>Detail</button>}
      />
    );
    expect(screen.getByText("Total Omzet")).toBeDefined();
    expect(screen.getByText("1.500.000")).toBeDefined();
    expect(screen.getByText("dari target 2.000.000")).toBeDefined();
    expect(screen.getByText("Detail")).toBeDefined();
  });

  it("renders progress bar with 0..1 fraction and clamps to 100%", () => {
    const { container } = render(
      <MetricBlock
        label="Pencapaian"
        value="44,5%"
        progress={0.445}
      />
    );
    const bar = container.querySelector(".bg-primary");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("style")).toContain("width: 44.5%");
  });

  it("renders progress bar with tone mapping", () => {
    const { container } = render(
      <MetricBlock
        label="Denda"
        value="Rp 50.000"
        tone="destructive"
        progress={0.25}
      />
    );
    const bar = container.querySelector(".bg-destructive");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("style")).toContain("width: 25%");
  });

  it("renders progress bar with object format { value, max, tone }", () => {
    const { container } = render(
      <MetricBlock
        label="Penilaian"
        value="24/26"
        progress={{ value: 24, max: 26, tone: "bg-success" }}
      />
    );
    const bar = container.querySelector(".bg-success");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("style")).toContain("width: 92.3076923076923%");
  });
});

describe("MetricRow", () => {
  it("renders with rounded-xl border bg-card p-5 card styling", () => {
    const { container } = render(
      <MetricRow title="Ringkasan Bisnis" columns={4}>
        <MetricBlock label="Metrik 1" value="100" />
      </MetricRow>
    );
    const section = container.querySelector("section");
    expect(section).toHaveClass("rounded-xl");
    expect(section).toHaveClass("border");
    expect(section).toHaveClass("bg-card");
    expect(section).toHaveClass("p-5");
    expect(screen.getByText("Ringkasan Bisnis")).toBeDefined();
  });

  it("allows unbordered mode when bordered=false", () => {
    const { container } = render(
      <MetricRow bordered={false}>
        <MetricBlock label="Metrik 1" value="100" />
      </MetricRow>
    );
    const section = container.querySelector("section");
    expect(section).toHaveClass("border-transparent");
  });
});

