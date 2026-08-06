import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox, type ComboboxOption } from "./combobox";

/**
 * Combobox selalu dipakai terkendali oleh induknya (filter PT, pilih pegawai,
 * pilih mata uang). Pembungkus ini meniru pemakaian itu supaya yang diuji
 * adalah nilai yang benar-benar sampai ke state induk — bukan sekadar teks
 * yang tampil di trigger.
 */
function Controlled({
  options,
  initial = "",
  ...rest
}: { options: ComboboxOption[]; initial?: string } & Partial<
  React.ComponentProps<typeof Combobox>
>) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Combobox
        {...rest}
        options={options}
        value={value}
        onValueChange={setValue}
      />
      <output data-testid="model">{value}</output>
    </>
  );
}

const PEGAWAI: ComboboxOption[] = [
  { value: "u1", label: "Andi Wijaya", description: "Kasir · Cabang Gading" },
  { value: "u2", label: "Budi Santoso", description: "Kepala Cabang · Cabang BSD" },
  { value: "u3", label: "Citra Lestari", description: "HR · Kantor Pusat" },
];

/** Lebih dari SEARCH_THRESHOLD (8), supaya kolom cari muncul otomatis. */
const BANYAK: ComboboxOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: `c${i}`,
  label: `Mata Uang ${i}`,
}));

describe("Combobox", () => {
  it("mengirim value opsi (bukan labelnya) ke induk saat dipilih", async () => {
    const user = userEvent.setup();
    render(<Controlled options={PEGAWAI} placeholder="Pilih karyawan..." />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Budi Santoso"));

    // cmdk menurunkan huruf pada value internalnya — yang sampai ke induk
    // harus tetap id aslinya.
    expect(screen.getByTestId("model")).toHaveTextContent("u2");
    expect(screen.getByRole("combobox")).toHaveTextContent("Budi Santoso");
  });

  it("menyaring berdasarkan label maupun description", async () => {
    const user = userEvent.setup();
    render(<Controlled options={PEGAWAI} searchable />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Cari..."), "bsd");

    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.queryByText("Andi Wijaya")).not.toBeInTheDocument();
    expect(screen.queryByText("Citra Lestari")).not.toBeInTheDocument();
  });

  it("menyembunyikan kolom cari untuk daftar pendek, memunculkannya untuk daftar panjang", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Controlled
        options={[
          { value: "BUY", label: "Beli" },
          { value: "SELL", label: "Jual" },
        ]}
      />
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByPlaceholderText("Cari...")).not.toBeInTheDocument();
    unmount();

    render(<Controlled options={BANYAK} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByPlaceholderText("Cari...")).toBeInTheDocument();
  });

  it("menampilkan pesan kosong saat pencarian tidak cocok", async () => {
    const user = userEvent.setup();
    render(<Controlled options={PEGAWAI} searchable emptyText="Tidak ketemu." />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Cari..."), "zzz");

    expect(screen.getByText("Tidak ketemu.")).toBeInTheDocument();
  });

  it("tidak bisa dibuka saat disabled", async () => {
    const user = userEvent.setup();
    render(<Controlled options={PEGAWAI} disabled />);

    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Andi Wijaya")).not.toBeInTheDocument();
  });
});
