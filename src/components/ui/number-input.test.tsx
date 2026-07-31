import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "./number-input";

/**
 * Meniru persis cara grid Bank Harian memakai NumberInput: nilainya TERKENDALI
 * oleh state induk, dan induknya menyimpan hasil `onValueChange` sebagai string.
 * Ini penting — pada input terkendali, karakter yang tidak menghasilkan angka
 * (tanda minus yang belum diikuti digit) bisa terhapus oleh render berikutnya,
 * sehingga saldo minus mustahil diketik walau `allowNegative` sudah menyala.
 */
function ControlledCell(props: { allowNegative?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <>
      <NumberInput
        value={value}
        // Sengaja disebar apa adanya: kalau pemanggil tidak menyebut
        // `allowNegative`, prop-nya benar-benar absen — bukan `undefined`.
        {...props}
        onValueChange={(val) => setValue(val === undefined ? "" : String(val))}
      />
      <output data-testid="model">{value}</output>
    </>
  );
}

describe("NumberInput", () => {
  // Dua bentuk "tidak meminta minus" harus sama-sama menolak: tidak meneruskan
  // prop-nya sama sekali (grid stock & kas), dan meneruskannya bernilai
  // `undefined` — bentuk kedua dulu justru MENGHIDUPKAN minus, karena default
  // react-number-format sendiri `true` dan spread props menimpa default kita.
  it("menolak tanda minus saat prop-nya tidak diberikan", async () => {
    const user = userEvent.setup();
    render(<ControlledCell />);
    await user.type(screen.getByRole("textbox"), "-5000");
    expect(screen.getByTestId("model").textContent).toBe("5000");
  });

  it("menolak tanda minus saat prop-nya diteruskan bernilai undefined", async () => {
    const user = userEvent.setup();
    render(<ControlledCell allowNegative={undefined} />);
    await user.type(screen.getByRole("textbox"), "-5000");
    expect(screen.getByTestId("model").textContent).toBe("5000");
  });

  it("menerima saldo minus saat allowNegative — rekening bisa overdraft", async () => {
    const user = userEvent.setup();
    render(<ControlledCell allowNegative />);
    await user.type(screen.getByRole("textbox"), "-5000");
    expect(screen.getByTestId("model").textContent).toBe("-5000");
  });

  it("tanda minus bertahan saat diketik lebih dulu, sebelum ada digitnya", async () => {
    const user = userEvent.setup();
    render(<ControlledCell allowNegative />);
    const input = screen.getByRole("textbox");
    await user.type(input, "-");
    // Belum ada angka, jadi model induk masih kosong — tapi tanda minusnya
    // tidak boleh hilang dari layar, kalau tidak digit berikutnya jadi positif.
    expect(input).toHaveValue("-");
  });

  it("saldo minus tampil dengan pemisah ribuan", async () => {
    const user = userEvent.setup();
    render(<ControlledCell allowNegative />);
    const input = screen.getByRole("textbox");
    await user.type(input, "-1500000");
    expect(input).toHaveValue("-1.500.000");
    expect(screen.getByTestId("model").textContent).toBe("-1500000");
  });
});
