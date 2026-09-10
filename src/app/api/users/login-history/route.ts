import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

/**
 * Menghapus riwayat login yang sudah KEDALUWARSA saja (`expiresAt` sudah
 * lewat) — sengaja tidak menghapus sesi yang masih berlaku, karena baris
 * sesi yang masih aktif ADALAH login pengguna itu sekarang. Menghapusnya
 * berarti memaksa logout siapa pun yang sedang memakai sistem, yang bukan
 * maksud "bersihkan riwayat" dan bisa mengagetkan pengguna di tengah kerja.
 */
export async function DELETE() {
  const authz = await authorize("users.login-history", "write");
  if (authz instanceof NextResponse) return authz;

  try {
    const { count } = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return NextResponse.json(
      ok({ count }, `${count} riwayat login kedaluwarsa dihapus`)
    );
  } catch (e) {
    return handleError(e);
  }
}
