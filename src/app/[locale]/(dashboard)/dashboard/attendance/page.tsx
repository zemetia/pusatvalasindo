import { Metadata } from "next";
import { AttendanceClient } from "./attendance-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getTranslations } from "next-intl/server";

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

  const initialRecords = await prisma.attendance.findMany({
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

  return (
    <div className="container max-w-4xl px-4 mx-auto">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("title")}</h1>
          <p className="text-slate-500 font-medium">{t("description")}</p>
        </div>
        
        <AttendanceClient 
          userId={session.user.id} 
          initialRecords={JSON.parse(JSON.stringify(initialRecords))} 
        />
      </div>
    </div>
  );
}
