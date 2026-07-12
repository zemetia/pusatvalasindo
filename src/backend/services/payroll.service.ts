import prisma from "@/lib/prisma";
import { kpiService } from "./kpi.service";
import { NotFoundError } from "@/backend/errors/app-error";
import type { BreakdownItem } from "@/lib/kpi-utils";

const WORK_START_HOUR = 17;
const WORK_START_MINUTE = 40;

export const payrollService = {
  calculateMonthlyPayroll: async (
    employeeId: string,
    month: number,
    year: number
  ) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // employee, KPI result, and attendances only depend on employeeId/date range,
    // not on each other — fetch them concurrently instead of round-tripping serially
    const [employee, kpiResult, attendances] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          name: true,
          baseSalary: true,
          mealAllowance: true,
          transportAllowance: true,
          positionAllowance: true,
          bpjsKesehatan: true,
        },
      }),
      // KPI calculation also saves/updates the KpiMonthlyResult record
      kpiService.calculateMonthlyResult(employeeId, month, year),
      prisma.attendance.findMany({
        where: { userId: employeeId, date: { gte: startDate, lt: endDate } },
      }),
    ]);

    if (!employee) throw new NotFoundError("Karyawan tidak ditemukan");

    const base = Number(employee.baseSalary ?? 0);
    const meal = Number(employee.mealAllowance ?? 0);
    const transport = Number(employee.transportAllowance ?? 0);
    const position = Number(employee.positionAllowance ?? 0);
    const bpjs = Number(employee.bpjsKesehatan ?? 0);
    const totalGrossFixed = base + meal + transport + position + bpjs;
    const dailyRate = totalGrossFixed / 24;

    let totalLateDeduction = 0;
    let totalAbsenceDeduction = 0;

    for (const att of attendances) {
      if (att.status === "LATE" && att.checkIn) {
        const checkIn = new Date(att.checkIn);
        const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
        const targetMinutes = WORK_START_HOUR * 60 + WORK_START_MINUTE;
        if (checkInMinutes > targetMinutes) {
          totalLateDeduction += (checkInMinutes - targetMinutes) * 1_000;
        }
      }

      if (att.status === "SICK") {
        totalAbsenceDeduction += dailyRate;
      } else if (att.status === "PERMISSION") {
        // Tanpa surat dokter = potong 2 hari; dengan surat = 1 hari
        totalAbsenceDeduction += att.isWithDoctorNote ? dailyRate : dailyRate * 2;
      } else if (att.status === "ABSENT") {
        totalAbsenceDeduction += dailyRate * 2;
      }
    }

    // Determine signed KPI adjustment based on result type
    const bonusRaw = Number(kpiResult.bonusAmount ?? 0);
    const resultType = kpiResult.bonusResult;
    let bonusKpi: number;
    if (resultType === "PENALTY_DEDUCTION" || resultType === "PENALTY_SATURDAY") {
      bonusKpi = -bonusRaw;
    } else if (resultType === "BONUS_CASH" || resultType === "TOP_PERFORMER") {
      bonusKpi = bonusRaw;
    } else {
      bonusKpi = 0; // SAFE_ZONE or undefined
    }

    const totalDeductions = totalLateDeduction + totalAbsenceDeduction;
    const takeHomePay = totalGrossFixed - totalDeductions + bonusKpi;

    return {
      employee: {
        id: employee.id,
        name: employee.name,
      },
      period: { month, year },
      components: {
        baseSalary: base,
        mealAllowance: meal,
        transportAllowance: transport,
        positionAllowance: position,
        bpjsKesehatan: bpjs,
        totalGrossFixed,
        dailyRate,
      },
      kpi: {
        score: Number(kpiResult.totalScore),
        bonusAmount: bonusRaw,
        bonusKpi,
        resultType,
        breakdownJson: kpiResult.breakdownJson as { items: BreakdownItem[] },
        calculatedAt: kpiResult.calculatedAt.toISOString(),
      },
      deductions: {
        late: totalLateDeduction,
        absence: totalAbsenceDeduction,
        total: totalDeductions,
      },
      final: {
        takeHomePay,
      },
      attendanceDetail: {
        totalDaysLogged: attendances.length,
      },
    };
  },
};
