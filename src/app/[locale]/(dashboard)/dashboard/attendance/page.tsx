import { Metadata } from "next";
import { AttendanceClient } from "./attendance-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { IconFingerprint } from "@tabler/icons-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dashboard.Attendance" });
  return {
    title: `${t("title")} - Pusat Valas Indo`,
    description: t("description"),
  };
}

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Dashboard.Attendance");

  // Get current month records
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let initialRecords;
  try {
    initialRecords = await prisma.attendance.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: {
        date: "desc",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[attendance/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<IconFingerprint className="size-5" />}
      />
      <AttendanceClient
        userId={session.user.id}
        initialRecords={JSON.parse(JSON.stringify(initialRecords))}
      />
    </div>
  );
}
