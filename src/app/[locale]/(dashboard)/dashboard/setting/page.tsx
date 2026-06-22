import { ModeToggle } from "@/components/mode-toggle";
import { PageHeader } from "@/components/admin/page-header";
import { IconSettings } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function Page() {
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi tampilan dan preferensi sistem."
        icon={<IconSettings className="size-5" />}
      />
      <Separator />
      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tampilan</CardTitle>
            <CardDescription>Pilih tema tampilan yang nyaman untuk Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mode Gelap / Terang</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ubah tema antarmuka sistem</p>
              </div>
              <ModeToggle />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
