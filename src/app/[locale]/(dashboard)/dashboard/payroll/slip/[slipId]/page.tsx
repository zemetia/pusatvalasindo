import { redirect } from "next/navigation";
import { IconReceipt } from "@tabler/icons-react";

import { payrollRunService } from "@/backend/services/payroll-run.service";
import { canViewPayrollOf } from "@/backend/services/payroll.service";
import { serializeSlipDetail } from "@/app/api/payroll/runs/serialize";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { PayrollSlipDetailClient } from "@/components/admin/payroll/payroll-slip-detail-client";
import { getCaller } from "@/backend/helpers/get-admin-caller";
import { getAuthzSubject } from "@/backend/helpers/authz";
import { allowsCompany } from "@/lib/authz/resolve";
import { MONTH_NAMES } from "@/lib/kpi-utils";

/**
 * Halaman detail gaji satu karyawan untuk satu bulan.
 *
 * Berbeda dari kalkulator cepat di halaman Payroll (yang menghitung tanpa
 * menyimpan), ini membuka PayrollSlip yang sudah tersimpan dari sebuah run —
 * angkanya persis yang akan (atau sudah) dibayarkan. Di sinilah HR menambah
 * penyesuaian manual (bonus/pengurangan di luar rule reward & denda) beserta
 * alasannya.
 */
export default async function PayrollSlipDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slipId: string }>;
}) {
  const { locale, slipId } = await params;
  const caller = await getCaller();
  if (!caller) redirect(`/${locale}/login`);
  const subject = await getAuthzSubject();
  if (!subject) redirect(`/${locale}/login`);

  const slip = await payrollRunService.getSlipDetail(slipId);
  if (!slip) {
    return <ErrorPanel source="payroll/slip/[slipId]" message="Slip gaji tidak ditemukan" />;
  }
  if (!canViewPayrollOf(subject, caller.id, slip.userId, slip.run.companyId)) {
    redirect(`/${locale}/dashboard/payroll`);
  }

  const view = serializeSlipDetail(slip);
  // Menambah/menghapus penyesuaian manual adalah wewenang mengelola gaji
  // orang lain di PT ini — bukan sekadar boleh melihat slipnya sendiri.
  const canManage = allowsCompany(subject, "payroll.manage", "write", slip.run.companyId);

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow={`${view.companyName} · ${MONTH_NAMES[view.periodMonth]} ${view.periodYear}`}
        title={view.employeeName}
        description={`${view.roleName} · ${view.branchName}`}
        icon={<IconReceipt className="size-5" />}
      />
      <PayrollSlipDetailClient slip={view} canManage={canManage} />
    </PageShell>
  );
}
