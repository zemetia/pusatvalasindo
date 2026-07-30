/**
 * POST /api/attendance/upload
 *
 * Receives a check-in photo and stores it in Supabase Storage.
 * Frontend must compress the photo to ≤50 KB before uploading.
 * Use `compressPhoto` from `lib/image-compress.ts`:
 *
 *   import { compressPhoto } from "@/lib/image-compress";
 *   const compressed = await compressPhoto(file);
 *   formData.append("photo", compressed);
 */

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSupabaseAdmin, ATTENDANCE_BUCKET } from "@/lib/supabase";
import { authorize } from "@/backend/helpers/authz";

export async function POST(req: NextRequest) {
  // Gerbangnya sama dengan clock-in itu sendiri — kalau tidak, foto masih bisa
  // diunggah ke bucket oleh siapa pun yang login meski Presensi-nya dicabut.
  const authz = await authorize("attendance.self", "write");
  if (authz instanceof NextResponse) return authz;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  if (file.size > 50 * 1024) {
    return NextResponse.json(
      { error: "File too large. Max 50 KB. Compress before uploading." },
      { status: 400 }
    );
  }

  const type = req.nextUrl.searchParams.get("type") === "checkout" ? "check-out" : "check-in";
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${type}/${session.user.id}/${Date.now()}.${ext}`;

  const { error } = await getSupabaseAdmin().storage
    .from(ATTENDANCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = getSupabaseAdmin().storage
    .from(ATTENDANCE_BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl });
}
