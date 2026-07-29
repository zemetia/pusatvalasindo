import { ModeToggle } from "@/components/mode-toggle";
import { PageShell, PageHeader, SectionCard } from "@/components/admin/page-shell";
import { IconSettings } from "@tabler/icons-react";

export default async function Page() {
  return (
    <PageShell width="narrow">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi tampilan dan preferensi sistem."
        icon={<IconSettings className="size-5" />}
      />

      <SectionCard
        title="Tampilan"
        description="Pilih tema tampilan yang nyaman untuk Anda."
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Mode Gelap / Terang</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Ubah tema antarmuka sistem
            </p>
          </div>
          <ModeToggle variant="outline" />
        </div>
      </SectionCard>
    </PageShell>
  );
}
