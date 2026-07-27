import { PERMISSIONS } from "@/lib/permissions";
import { requirePageCaller } from "@/backend/helpers/page-access";
import { getWatcherValasData } from "@/backend/services/watcher-valas.service";
import { WatcherValasPageClient } from "@/components/admin/watcher-valas-page-client";

export default async function WatcherValasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageCaller(PERMISSIONS.STOCKIST_VIEW, locale);

  const data = await getWatcherValasData();

  return <WatcherValasPageClient initialData={data} />;
}
