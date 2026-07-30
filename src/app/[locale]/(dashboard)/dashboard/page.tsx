export const maxDuration = 30; // extend Vercel function timeout to 30s

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { getDashboardBucket } from "@/backend/services/dashboard-data.service";
import { DashboardOwner } from "@/components/dashboard/dashboard-owner";
import { DashboardKepalaCabang } from "@/components/dashboard/dashboard-kepala-cabang";
import { DashboardPegawai } from "@/components/dashboard/dashboard-pegawai";

/**
 * Router tipis: tiap role punya halaman dashboard penuh sendiri (lihat
 * src/components/dashboard/). Di sini cuma resolve session/caller lalu pilih
 * komponen yang sesuai — tidak ada logic tampilan di file ini.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/login`);

  const caller = await getCaller();
  if (!caller) redirect(`/${locale}/login`);
  const subject = await getAuthzSubject();
  if (!subject) redirect(`/${locale}/login`);

  const userName = session.user.name?.split(" ")[0] ?? "";
  const bucket = getDashboardBucket(caller.roleName);

  if (bucket === "owner") return <DashboardOwner caller={caller} subject={subject} userName={userName} />;
  if (bucket === "kepala_cabang") return <DashboardKepalaCabang caller={caller} subject={subject} userName={userName} />;
  return <DashboardPegawai caller={caller} subject={subject} userName={userName} />;
}
