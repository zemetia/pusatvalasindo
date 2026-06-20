import prisma from "@/lib/prisma";
import { kpiService } from "./kpi.service";
import { NotFoundError } from "@/backend/errors/app-error";

export const payrollService = {
  calculateMonthlyPayroll: async (
    employeeId: string,
    month: number,
    year: number
  ) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // 1. Fetch Employee Data (Salary Components)
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        baseSalary: true,
        mealAllowance: true,
        transportAllowance: true,
      },
    });

    if (!employee) throw new NotFoundError("Karyawan tidak ditemukan");

    // 2. Get KPI Results (Bonus & Score)
    // This will call the kpiService logic we previously separated
    const kpiResult = await kpiService.calculateMonthlyResult(employeeId, month, year);

    // 3. Fetch Attendance Data
    const attendances = await prisma.attendance.findMany({
      where: { userId: employeeId, date: { gte: startDate, lt: endDate } },
    });

    // 4. Payroll Calculation Logic
    const base = Number(employee.baseSalary ?? 0);
    const meal = Number(employee.mealAllowance ?? 0);
    const transport = Number(employee.transportAllowance ?? 0);
    const totalGrossFixed = base + meal + transport;
    const dailyRate = totalGrossFixed / 24;

    let totalLateDeduction = 0;
    let totalAbsenceDeduction = 0;
    
    // Constant for late check (Matching app/api/attendance/route.ts)
    const WORK_START_HOUR = 17;
    const WORK_START_MINUTE = 40;

    for (const att of attendances) {
      // A. Late Deduction (1 min = 1000)
      if (att.status === "LATE" && att.checkIn) {
        const checkIn = new Date(att.checkIn);
        const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
        const targetMinutes = WORK_START_HOUR * 60 + WORK_START_MINUTE;
        
        if (checkInMinutes > targetMinutes) {
          const lateMinutes = checkInMinutes - targetMinutes;
          totalLateDeduction += lateMinutes * 1000;
        }
      }

      // B. Status Based Deduction
      if (att.status === "SICK") {
        totalAbsenceDeduction += dailyRate; // Ijin Sakit = 1 hari
      } else if (att.status === "PERMISSION") {
        // Detect "Tanpa Surat Dokter" from notes
        const isWithoutNote = att.notes?.toLowerCase().includes("tanpa surat");
        if (isWithoutNote) {
          totalAbsenceDeduction += dailyRate * 2; // Tanpa S. Dokter = 2 hari
        } else {
          totalAbsenceDeduction += dailyRate; // Ijin ACC Bos = 1 hari
        }
      } else if (att.status === "ABSENT") {
        totalAbsenceDeduction += dailyRate * 2; // Alfa = 2 hari
      }
    }

    const bonusKpi = Number(kpiResult.bonusAmount ?? 0);
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
        totalGrossFixed,
        dailyRate,
      },
      kpi: {
        score: Number(kpiResult.totalScore),
        bonus: bonusKpi,
        resultType: kpiResult.bonusResult,
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
      }
    };
  },
};
