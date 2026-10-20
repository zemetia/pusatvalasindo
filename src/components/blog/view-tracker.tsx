"use client";

import { useEffect } from "react";

/**
 * Mengirim satu sinyal "artikel ini dibaca" ke /api/blog-view setelah halaman
 * tampil di browser. Dipanggil dari browser (bukan saat render di server) supaya
 * halaman tetap bisa di-cache dan crawler yang tidak menjalankan JavaScript tidak
 * ikut terhitung.
 *
 * Kegagalan (offline, diblokir ekstensi, 429) sengaja diabaikan: statistik tidak
 * boleh mengganggu pembaca. Dedup sesungguhnya ada di server; penanda sessionStorage
 * hanya menghemat request untuk refresh/back dalam tab yang sama.
 */
export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `blog-view:${postId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage bisa melempar (mode privat / diblokir) — lanjutkan, server tetap mendedup.
    }

    void fetch("/api/blog-view", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, referrer: document.referrer || null }),
    }).catch(() => undefined);
  }, [postId]);

  return null;
}
