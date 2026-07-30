import { requireResource } from "@/backend/helpers/authz";
import { getWatcherValasData } from "@/backend/services/watcher-valas.service";
import { WatcherValasPageClient } from "@/components/admin/watcher-valas-page-client";

/**
 * Watcher Valas — resource `watcher.valas`, scoping global.
 *
 * Yang dipantau adalah kurs pasar (counter SmartDeal vs mid-rate Yahoo
 * Finance), bukan data milik satu PT, jadi izinnya tidak punya dimensi PT.
 */
export default async function WatcherValasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireResource("watcher.valas", "view", locale);

  const data = await getWatcherValasData();

  return <WatcherValasPageClient initialData={data} />;
}
