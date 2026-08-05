// ═══════════════════════════════════════════════════════════════════════════
// Ekspresi rule: `formula` pada tier dan `if` pada guard.
//
// Ekspresi diurai menjadi pohon lalu dievaluasi oleh kode di file ini —
// TIDAK PERNAH diserahkan ke `eval`, `new Function`, atau sejenisnya. Isi file
// rule adalah teks dari disk; kalau ia bisa dieksekusi sebagai kode, siapa pun
// yang bisa menulis file rule bisa menjalankan apa saja di server.
//
// Acuan bagian 5 spesifikasi: docs/tasks/spesifikasi-rule-slip-gaji.md
// ═══════════════════════════════════════════════════════════════════════════

/** Fungsi yang boleh dipanggil di dalam ekspresi. Tidak ada yang lain. */
const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  abs: (x) => Math.abs(x),
};

const FUNCTION_ARITY: Record<string, number[]> = {
  min: [2],
  max: [2],
  round: [1],
  floor: [1],
  ceil: [1],
  abs: [1],
};

export type Node =
  | { kind: "number"; value: number }
  | { kind: "ref"; name: string }
  | { kind: "unary"; op: "-"; arg: Node }
  | { kind: "binary"; op: BinaryOp; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };

type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "and"
  | "or";

const COMPARISONS: BinaryOp[] = ["==", "!=", "<", "<=", ">", ">="];

/**
 * Operator logika, ditulis sebagai kata — bukan `&&`/`||`.
 *
 * Sebelum keduanya ada, kondisi majemuk ditulis dengan memanfaatkan
 * perbandingan yang mengembalikan 1/0: `(A) * (B) == 1` sebagai AND dan
 * `(A) + (B) >= 1` sebagai OR. Bentuk itu jalan, tapi berbahaya untuk uang —
 * `(A) + (B) == 1` beda satu karakter dari OR dan artinya XOR, tetap lolos
 * validasi, dan salahnya baru kelihatan di slip seseorang.
 *
 * Bentuk lama TIDAK dilarang; ia tetap aritmetika yang sah dan rule lama tidak
 * perlu diubah untuk tetap berjalan.
 */
const LOGICALS: BinaryOp[] = ["and", "or"];

export class ExpressionError extends Error {}

// ── Tokenizer ──────────────────────────────────────────────────────────────

type Token =
  | { t: "num"; v: number }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "("; }
  | { t: ")"; }
  | { t: ","; };

const OPERATOR_CHARS = new Set(["+", "-", "*", "/", "%", "=", "!", "<", ">"]);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (c === "(") {
      out.push({ t: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: ")" });
      i++;
      continue;
    }
    if (c === ",") {
      out.push({ t: "," });
      i++;
      continue;
    }

    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new ExpressionError(`Angka tidak valid: "${raw}"`);
      }
      out.push({ t: "num", v: value });
      i = j;
      continue;
    }

    // Identifier boleh mengandung titik (`karyawan.gaji_pokok`) — satu tingkat
    // saja; akses properti berantai ditolak di parser.
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      const word = src.slice(i, j);
      // `and`/`or` adalah operator, bukan nama kolom. Dicocokkan sebagai KATA
      // UTUH, jadi kolom bernama `android` atau `oranye` tetap terbaca sebagai
      // rujukan biasa.
      out.push(
        (LOGICALS as string[]).includes(word)
          ? { t: "op", v: word }
          : { t: "ident", v: word }
      );
      i = j;
      continue;
    }

    if (OPERATOR_CHARS.has(c)) {
      const two = src.slice(i, i + 2);
      if (["==", "!=", "<=", ">="].includes(two)) {
        out.push({ t: "op", v: two });
        i += 2;
        continue;
      }
      if (c === "=" || c === "!") {
        throw new ExpressionError(
          `Operator "${c}" tidak dikenal — pakai "==" atau "!=".`
        );
      }
      out.push({ t: "op", v: c });
      i++;
      continue;
    }

    throw new ExpressionError(`Karakter tidak diizinkan dalam ekspresi: "${c}"`);
  }

  return out;
}

// ── Parser (recursive descent) ─────────────────────────────────────────────
//
// atau          →  dan ( "or" dan )*
// dan           →  perbandingan ( "and" perbandingan )*
// perbandingan  →  penjumlahan ( ("=="|"!="|"<"|"<="|">"|">=") penjumlahan )?
// penjumlahan   →  perkalian ( ("+"|"-") perkalian )*
// perkalian     →  unary ( ("*"|"/"|"%") unary )*
// unary         →  "-" unary | primary
// primary       →  angka | ident | ident "(" args ")" | "(" atau ")"
//
// `or` mengikat paling longgar, jadi `a == 1 and b == 2 or c == 3` terbaca
// `(a == 1 and b == 2) or (c == 3)` — urutan yang sama dengan SQL dan
// kebanyakan bahasa, supaya tidak ada yang perlu menghafal pengecualian.

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(allowComparison: boolean): Node {
    const node = allowComparison ? this.or() : this.additive();
    if (this.pos < this.tokens.length) {
      throw new ExpressionError("Ada sisa token yang tidak bisa dibaca di akhir ekspresi.");
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private or(): Node {
    let left = this.and();
    while (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "or") {
      this.pos++;
      left = { kind: "binary", op: "or", left, right: this.and() };
    }
    return left;
  }

  private and(): Node {
    let left = this.comparison();
    while (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "and") {
      this.pos++;
      left = { kind: "binary", op: "and", left, right: this.comparison() };
    }
    return left;
  }

  private comparison(): Node {
    const left = this.additive();
    const tok = this.peek();
    if (tok?.t === "op" && COMPARISONS.includes(tok.v as BinaryOp)) {
      this.pos++;
      const right = this.additive();
      // Perbandingan tidak berantai: `a < b < c` tidak punya makna yang jelas.
      const next = this.peek();
      if (next?.t === "op" && COMPARISONS.includes(next.v as BinaryOp)) {
        throw new ExpressionError("Perbandingan berantai tidak didukung.");
      }
      return { kind: "binary", op: tok.v as BinaryOp, left, right };
    }
    return left;
  }

  private additive(): Node {
    let left = this.multiplicative();
    for (;;) {
      const tok = this.peek();
      if (tok?.t === "op" && (tok.v === "+" || tok.v === "-")) {
        this.pos++;
        left = { kind: "binary", op: tok.v, left, right: this.multiplicative() };
        continue;
      }
      return left;
    }
  }

  private multiplicative(): Node {
    let left = this.unary();
    for (;;) {
      const tok = this.peek();
      if (tok?.t === "op" && (tok.v === "*" || tok.v === "/" || tok.v === "%")) {
        this.pos++;
        left = { kind: "binary", op: tok.v, left, right: this.unary() };
        continue;
      }
      return left;
    }
  }

  private unary(): Node {
    const tok = this.peek();
    if (tok?.t === "op" && tok.v === "-") {
      this.pos++;
      return { kind: "unary", op: "-", arg: this.unary() };
    }
    if (tok?.t === "op" && tok.v === "+") {
      this.pos++;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): Node {
    const tok = this.peek();
    if (!tok) throw new ExpressionError("Ekspresi berakhir lebih cepat dari yang diharapkan.");

    if (tok.t === "num") {
      this.pos++;
      return { kind: "number", value: tok.v };
    }

    if (tok.t === "(") {
      this.pos++;
      const inner = this.or();
      if (this.peek()?.t !== ")") throw new ExpressionError('Kurung tutup ")" tidak ditemukan.');
      this.pos++;
      return inner;
    }

    if (tok.t === "ident") {
      this.pos++;
      const name = tok.v;

      if (this.peek()?.t === "(") {
        this.pos++;
        if (!(name in FUNCTIONS)) {
          throw new ExpressionError(
            `Fungsi "${name}" tidak diizinkan. Yang tersedia: ${Object.keys(FUNCTIONS).join(", ")}.`
          );
        }
        const args: Node[] = [];
        if (this.peek()?.t !== ")") {
          for (;;) {
            args.push(this.or());
            if (this.peek()?.t === ",") {
              this.pos++;
              continue;
            }
            break;
          }
        }
        if (this.peek()?.t !== ")") throw new ExpressionError(`Kurung tutup untuk "${name}(" tidak ditemukan.`);
        this.pos++;

        const arity = FUNCTION_ARITY[name];
        if (!arity.includes(args.length)) {
          throw new ExpressionError(
            `Fungsi "${name}" butuh ${arity.join("/")} argumen, diberi ${args.length}.`
          );
        }
        return { kind: "call", name, args };
      }

      // Akses properti berantai (`a.b.c`) dilarang — satu titik saja.
      if (name.split(".").length > 2) {
        throw new ExpressionError(`Rujukan berantai tidak diizinkan: "${name}".`);
      }
      if (name.endsWith(".") || name.startsWith(".")) {
        throw new ExpressionError(`Rujukan tidak lengkap: "${name}".`);
      }
      return { kind: "ref", name };
    }

    throw new ExpressionError(`Token tidak diharapkan pada posisi ini: "${JSON.stringify(tok)}".`);
  }
}

/** Urai ekspresi tier (`formula`) — perbandingan DILARANG, hasilnya angka. */
export function parseFormula(src: string): Node {
  const node = new Parser(tokenize(src)).parse(false);
  assertNoComparison(node);
  return node;
}

/** Urai ekspresi guard (`if`) — wajib menghasilkan perbandingan. */
export function parseCondition(src: string): Node {
  const node = new Parser(tokenize(src)).parse(true);
  const berbentukKondisi =
    node.kind === "binary" && (COMPARISONS.includes(node.op) || LOGICALS.includes(node.op));
  if (!berbentukKondisi) {
    throw new ExpressionError(
      "Kondisi guard harus berupa perbandingan atau gabungannya, mis. " +
        "`hari_tercatat == 0` atau `berkontrak == 0 and skor >= 86`."
    );
  }
  return node;
}

function assertNoComparison(node: Node) {
  switch (node.kind) {
    case "binary":
      if (LOGICALS.includes(node.op)) {
        throw new ExpressionError(
          "Formula tidak boleh memuat `and`/`or` — keduanya menghasilkan benar/salah, " +
            "bukan rupiah. Pindahkan syaratnya ke `guard`."
        );
      }
      if (COMPARISONS.includes(node.op)) {
        throw new ExpressionError(
          "Formula tier tidak boleh memuat perbandingan — pakai tier `min`/`max` untuk itu."
        );
      }
      assertNoComparison(node.left);
      assertNoComparison(node.right);
      return;
    case "unary":
      assertNoComparison(node.arg);
      return;
    case "call":
      node.args.forEach(assertNoComparison);
      return;
    default:
      return;
  }
}

/** Semua nama yang dirujuk ekspresi — dipakai validator untuk mengecek asalnya. */
export function collectRefs(node: Node, into: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case "ref":
      into.add(node.name);
      break;
    case "unary":
      collectRefs(node.arg, into);
      break;
    case "binary":
      collectRefs(node.left, into);
      collectRefs(node.right, into);
      break;
    case "call":
      node.args.forEach((a) => collectRefs(a, into));
      break;
  }
  return into;
}

/** Konstanta bernilai nol yang dipakai sebagai pembagi — dilarang validator. */
export function findZeroDivision(node: Node, constants: Record<string, number>): string | null {
  const walk = (n: Node): string | null => {
    if (n.kind === "binary") {
      if (n.op === "/" || n.op === "%") {
        if (n.right.kind === "number" && n.right.value === 0) return String(n.right.value);
        if (n.right.kind === "ref") {
          const bare = n.right.name.replace(/^konstanta\./, "");
          if (bare in constants && constants[bare] === 0) return bare;
        }
      }
      return walk(n.left) ?? walk(n.right);
    }
    if (n.kind === "unary") return walk(n.arg);
    if (n.kind === "call") {
      for (const a of n.args) {
        const found = walk(a);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(node);
}

/** Rujukan bernilai `null`/`undefined` saat evaluasi — engine men-skip rule. */
export class MissingValueError extends Error {
  constructor(public readonly ref: string) {
    super(`Nilai "${ref}" kosong`);
  }
}

/**
 * Evaluasi pohon terhadap scope.
 *
 * Nilai `null`/`undefined` TIDAK dianggap nol — itu melempar
 * `MissingValueError` supaya engine bisa men-skip rule dengan flag, bukan
 * memotong gaji berdasarkan tebakan (lihat bagian 5 spesifikasi).
 */
export function evaluate(node: Node, scope: Record<string, unknown>): number {
  switch (node.kind) {
    case "number":
      return node.value;

    case "ref": {
      // `konstanta.x` dan `x` menunjuk hal yang sama — spesifikasi mengizinkan
      // konstanta ditulis tanpa awalan.
      const raw =
        node.name in scope
          ? scope[node.name]
          : scope[node.name.replace(/^konstanta\./, "")];
      if (raw === null || raw === undefined) throw new MissingValueError(node.name);
      if (raw instanceof Date) return raw.getTime();
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num)) throw new MissingValueError(node.name);
      return num;
    }

    case "unary":
      return -evaluate(node.arg, scope);

    case "call": {
      const args = node.args.map((a) => evaluate(a, scope));
      return FUNCTIONS[node.name](...args);
    }

    case "binary": {
      const l = evaluate(node.left, scope);
      const r = evaluate(node.right, scope);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          if (r === 0) throw new ExpressionError("Pembagian dengan nol saat evaluasi.");
          return l / r;
        case "%":
          if (r === 0) throw new ExpressionError("Modulo dengan nol saat evaluasi.");
          return l % r;
        // Perbandingan menghasilkan 1/0 supaya tipe kembaliannya tetap angka;
        // guard hanya melihat `!== 0`.
        case "==":
          return l === r ? 1 : 0;
        case "!=":
          return l !== r ? 1 : 0;
        case "<":
          return l < r ? 1 : 0;
        case "<=":
          return l <= r ? 1 : 0;
        case ">":
          return l > r ? 1 : 0;
        case ">=":
          return l >= r ? 1 : 0;

        // SENGAJA tidak hubung-singkat: kedua sisi selalu dievaluasi.
        //
        // `berkontrak == 0 or skor == 0` dengan hubung-singkat akan berhasil
        // walaupun `skor` tidak ada nilainya — kondisi terjawab "benar" dari
        // data yang separuhnya hilang, dan MissingValueError yang seharusnya
        // menahan pembayaran tidak pernah terlempar. Untuk uang, lebih baik
        // rule berhenti dan minta diperiksa.
        case "and":
          return l !== 0 && r !== 0 ? 1 : 0;
        case "or":
          return l !== 0 || r !== 0 ? 1 : 0;
      }
    }
  }
}

/**
 * Pembulatan ke rupiah terdekat, 0,5 ke atas — persis perilaku `Math.round`,
 * termasuk untuk angka negatif (−10.5 → −10). Kebijakan lain harus ditulis
 * eksplisit di formula dengan `floor`/`ceil`.
 */
export function roundRupiah(value: number): number {
  return Math.round(value);
}
