"use client"

import { type KeyboardEvent, useCallback, useRef } from "react"

export type GridNavDirection = "up" | "down" | "left" | "right"

type Options = {
  /** Urutan kolom sesuai tampilan — index-nya yang dipakai untuk gerakan kiri/kanan. */
  columns: readonly string[]
  rowCount: number
  /** Kolom yang isinya langsung diseleksi begitu sel dituju (mis. kolom angka), atau `true` untuk semua. */
  selectOnFocus?: readonly string[] | boolean
}

type CellKeyDownOptions = {
  /** Aktifkan panah kiri/kanan. Hanya lompat kalau caret sudah di ujung teks. */
  horizontal?: boolean
}

/**
 * Navigasi antar sel input ala spreadsheet: panah atas/bawah (dan kiri/kanan kalau
 * `horizontal`) memindah fokus ke sel tetangga. Karena fokus pindah, `onBlur` sel asal
 * tetap jalan — jadi autosave yang sudah ada ikut kepanggil tanpa perlu tekan Enter.
 *
 * Sel yang tidak terdaftar (mis. kolom read-only) atau yang `disabled` dilewati, jadi
 * grid yang tidak rapat pun tetap bisa dinavigasi.
 */
export function useGridKeyboardNav({ columns, rowCount, selectOnFocus = false }: Options) {
  const cells = useRef<Map<string, HTMLInputElement>>(new Map())

  const registerCell = useCallback(
    (row: number, column: string) => (el: HTMLInputElement | null) => {
      const key = `${row}:${column}`
      if (el) cells.current.set(key, el)
      else cells.current.delete(key)
    },
    []
  )

  /** Pindah fokus satu langkah ke arah `direction`. Mengembalikan false kalau tidak ada tujuan. */
  const moveFocus = useCallback(
    (row: number, column: string, direction: GridNavDirection) => {
      const colIndex = columns.indexOf(column)
      if (colIndex === -1) return false

      const stepRow = direction === "up" ? -1 : direction === "down" ? 1 : 0
      const stepCol = direction === "left" ? -1 : direction === "right" ? 1 : 0

      let r = row + stepRow
      let c = colIndex + stepCol
      while (r >= 0 && r < rowCount && c >= 0 && c < columns.length) {
        const target = cells.current.get(`${r}:${columns[c]}`)
        if (target && !target.disabled) {
          target.focus()
          const shouldSelect =
            selectOnFocus === true ||
            (Array.isArray(selectOnFocus) && selectOnFocus.includes(columns[c]))
          if (shouldSelect) target.select()
          return true
        }
        r += stepRow
        c += stepCol
      }
      return false
    },
    [columns, rowCount, selectOnFocus]
  )

  /**
   * Handler `onKeyDown` untuk satu sel. Mengembalikan true kalau tombolnya dipakai untuk
   * navigasi, supaya pemanggil bisa menambahkan perilaku sendiri untuk tombol lain.
   */
  const handleCellKeyDown = useCallback(
    (row: number, column: string, options: CellKeyDownOptions = {}) =>
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return false

        if (e.key === "Enter" || e.key === "ArrowDown") {
          e.preventDefault()
          // Di baris terakhir tidak ada tujuan — blur saja supaya isian terakhir tetap tersimpan.
          if (!moveFocus(row, column, "down") && e.key === "Enter") e.currentTarget.blur()
          return true
        }

        if (e.key === "ArrowUp") {
          e.preventDefault()
          moveFocus(row, column, "up")
          return true
        }

        if (options.horizontal && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          // Panah kiri/kanan tetap milik caret selama masih ada teks yang bisa dilewati —
          // baru lompat sel kalau caret sudah mentok dan tidak ada teks yang diseleksi.
          const input = e.currentTarget
          const { selectionStart, selectionEnd, value } = input
          const collapsed = selectionStart !== null && selectionStart === selectionEnd
          const atStart = collapsed && selectionStart === 0
          const atEnd = collapsed && selectionEnd === value.length

          if (e.key === "ArrowLeft" ? atStart : atEnd) {
            e.preventDefault()
            moveFocus(row, column, e.key === "ArrowLeft" ? "left" : "right")
            return true
          }
        }

        return false
      },
    [moveFocus]
  )

  return { registerCell, moveFocus, handleCellKeyDown }
}
