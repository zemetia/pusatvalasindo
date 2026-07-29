import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NumberInput } from "@/components/ui/number-input"
import { useGridKeyboardNav } from "./use-grid-keyboard-nav"

// Kolom "total" sengaja tidak punya input — meniru kolom read-only di grid stock,
// yang harus dilompati saat navigasi kiri/kanan.
const COLUMNS = ["a", "total", "b"] as const
const ROWS = [0, 1, 2]

function Grid({ onBlurCell, disabled }: { onBlurCell?: (id: string) => void; disabled?: string }) {
  const [values, setValues] = useState<Record<string, number | undefined>>({})
  const { registerCell, handleCellKeyDown } = useGridKeyboardNav({
    columns: COLUMNS,
    rowCount: ROWS.length,
    selectOnFocus: true,
  })

  return (
    <table>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row}>
            {COLUMNS.map((col) =>
              col === "total" ? (
                <td key={col}>total</td>
              ) : (
                <td key={col}>
                  <NumberInput
                    data-testid={`${row}-${col}`}
                    ref={registerCell(row, col)}
                    disabled={disabled === `${row}-${col}`}
                    value={values[`${row}-${col}`]}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [`${row}-${col}`]: v }))}
                    onKeyDown={handleCellKeyDown(row, col, { horizontal: true })}
                    onBlur={() => onBlurCell?.(`${row}-${col}`)}
                  />
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const cell = (id: string) => screen.getByTestId(id) as HTMLInputElement

describe("useGridKeyboardNav", () => {
  it("panah atas/bawah pindah baris di kolom yang sama", async () => {
    const user = userEvent.setup()
    render(<Grid />)

    await user.click(cell("0-a"))
    await user.keyboard("{ArrowDown}")
    expect(cell("1-a")).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(cell("2-a")).toHaveFocus()

    await user.keyboard("{ArrowUp}")
    expect(cell("1-a")).toHaveFocus()
  })

  it("memicu blur sel asal, jadi autosave jalan tanpa Enter", async () => {
    const user = userEvent.setup()
    const onBlurCell = vi.fn()
    render(<Grid onBlurCell={onBlurCell} />)

    await user.click(cell("0-a"))
    await user.keyboard("1500")
    await user.keyboard("{ArrowDown}")

    expect(onBlurCell).toHaveBeenCalledWith("0-a")
    expect(cell("1-a")).toHaveFocus()
  })

  it("Enter di baris terakhir tetap blur supaya isian tersimpan", async () => {
    const user = userEvent.setup()
    const onBlurCell = vi.fn()
    render(<Grid onBlurCell={onBlurCell} />)

    await user.click(cell("2-a"))
    await user.keyboard("250{Enter}")

    expect(onBlurCell).toHaveBeenCalledWith("2-a")
    expect(cell("2-a")).not.toHaveFocus()
  })

  it("panah kanan lompat kolom hanya saat caret di ujung, melewati kolom read-only", async () => {
    const user = userEvent.setup()
    render(<Grid />)

    await user.click(cell("0-a"))
    await user.keyboard("120")
    // Caret di ujung kanan → lompat ke kolom berikutnya yang punya input ("total" dilewati).
    await user.keyboard("{ArrowRight}")
    expect(cell("0-b")).toHaveFocus()
  })

  it("panah kiri/kanan tetap menggerakkan caret selama belum mentok", async () => {
    const user = userEvent.setup()
    render(<Grid />)

    const input = cell("0-b")
    await user.click(input)
    await user.keyboard("120")
    input.setSelectionRange(1, 1)

    await user.keyboard("{ArrowLeft}")
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)

    // Sudah mentok di kiri → baru pindah sel.
    await user.keyboard("{ArrowLeft}")
    expect(cell("0-a")).toHaveFocus()
  })

  it("melewati sel yang disabled", async () => {
    const user = userEvent.setup()
    render(<Grid disabled="1-a" />)

    await user.click(cell("0-a"))
    await user.keyboard("{ArrowDown}")
    expect(cell("2-a")).toHaveFocus()
  })

  it("menyeleksi isi sel tujuan supaya langsung bisa ditimpa", async () => {
    const user = userEvent.setup()
    render(<Grid />)

    await user.click(cell("1-a"))
    await user.keyboard("900")
    await user.click(cell("0-a"))
    await user.keyboard("{ArrowDown}")

    const target = cell("1-a")
    expect(target).toHaveFocus()
    expect(target.selectionStart).toBe(0)
    expect(target.selectionEnd).toBe(target.value.length)
  })
})
