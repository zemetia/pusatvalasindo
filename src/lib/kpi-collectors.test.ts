import { describe, it, expect } from "vitest";
import {
  collectAttendanceDiscipline,
  collectClosingPunctuality,
  parseClockTime,
  runCollector,
  DISCIPLINE_WEIGHTS,
  type AttendanceRecord,
} from "./kpi-collectors";

/** Shift tanggal 3 Juli 2026; check-out jatuh pagi tanggal 4. */
// Tanggal shift memakai tengah malam UTC (konvensi kolom @db.Date), sedangkan
// jam absen pulang adalah timestamp biasa sehingga tetap waktu lokal.
const shiftDate = (day: number) => new Date(Date.UTC(2026, 6, day));
const checkOutAt = (day: number, hour: number, minute: number) =>
  new Date(2026, 6, day + 1, hour, minute);

const record = (over: Partial<AttendanceRecord> & { date: Date }): AttendanceRecord => ({
  status: "PRESENT",
  checkIn: null,
  checkOut: null,
  isWithDoctorNote: false,
  ...over,
});

describe("collectAttendanceDiscipline", () => {
  it("mencatat keterlambatan sebagai satu pelanggaran", () => {
    const { entries } = collectAttendanceDiscipline([
      record({ date: shiftDate(3), status: "LATE", checkIn: new Date(2026, 6, 3, 18, 5) }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(DISCIPLINE_WEIGHTS.LATE);
    expect(entries[0].note).toContain("terlambat");
  });

  it("menimbang alpa lebih berat daripada terlambat", () => {
    const { entries } = collectAttendanceDiscipline([
      record({ date: shiftDate(3), status: "ABSENT" }),
    ]);
    expect(entries[0].quantity).toBe(DISCIPLINE_WEIGHTS.ABSENT);
    expect(entries[0].quantity).toBeGreaterThan(DISCIPLINE_WEIGHTS.LATE);
  });

  it("izin tanpa surat dokter dihitung, yang bersurat tidak", () => {
    const { entries, skipped } = collectAttendanceDiscipline([
      record({ date: shiftDate(3), status: "PERMISSION", isWithDoctorNote: false }),
      record({ date: shiftDate(4), status: "PERMISSION", isWithDoctorNote: true }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(DISCIPLINE_WEIGHTS.PERMISSION_NO_NOTE);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain("surat dokter");
  });

  it("sakit tidak dihukum dua kali — sudah dipotong di payroll", () => {
    const { entries, skipped } = collectAttendanceDiscipline([
      record({ date: shiftDate(3), status: "SICK" }),
    ]);
    expect(entries).toHaveLength(0);
    expect(skipped[0].reason).toContain("potongan gaji");
  });

  it("hadir dan libur tidak menghasilkan apa pun", () => {
    const { entries, skipped } = collectAttendanceDiscipline([
      record({ date: shiftDate(3), status: "PRESENT" }),
      record({ date: shiftDate(4), status: "HOLIDAY" }),
    ]);
    expect(entries).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });
});

describe("collectClosingPunctuality", () => {
  const config = { deadline: "05:15", graceMinutes: 60 };

  it("closing sebelum batas + toleransi tidak kena penalti", () => {
    const { entries } = collectClosingPunctuality(
      [record({ date: shiftDate(3), checkOut: checkOutAt(3, 6, 0) })],
      config
    );
    expect(entries).toHaveLength(0);
  });

  it("tepat di batas toleransi belum dihitung terlambat", () => {
    // 05:15 + 60 menit = 06:15
    const { entries } = collectClosingPunctuality(
      [record({ date: shiftDate(3), checkOut: checkOutAt(3, 6, 15) })],
      config
    );
    expect(entries).toHaveLength(0);
  });

  it("lewat batas toleransi menghasilkan satu pelanggaran per hari", () => {
    const { entries } = collectClosingPunctuality(
      [record({ date: shiftDate(3), checkOut: checkOutAt(3, 6, 45) })],
      config
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(1);
    expect(entries[0].note).toContain("lewat 30 menit");
  });

  it("batas jam berbeda antar PT menghasilkan penilaian berbeda", () => {
    const checkOut = checkOutAt(3, 6, 10);
    const pvi = collectClosingPunctuality([record({ date: shiftDate(3), checkOut })], {
      deadline: "05:15",
      graceMinutes: 60,
    });
    const ptu = collectClosingPunctuality([record({ date: shiftDate(3), checkOut })], {
      deadline: "05:00",
      graceMinutes: 60,
    });
    expect(pvi.entries).toHaveLength(0); // batas 06:15
    expect(ptu.entries).toHaveLength(1); // batas 06:00
  });

  it("tanpa absen pulang dilewati, bukan dihukum", () => {
    const { entries, skipped } = collectClosingPunctuality(
      [record({ date: shiftDate(3), checkOut: null })],
      config
    );
    expect(entries).toHaveLength(0);
    expect(skipped[0].reason).toContain("absen pulang");
  });

  it("absen pulang di luar pola shift dilewati untuk diperiksa manual", () => {
    const { entries, skipped } = collectClosingPunctuality(
      [record({ date: shiftDate(3), checkOut: new Date(2026, 6, 4, 16, 0) })],
      config
    );
    expect(entries).toHaveLength(0);
    expect(skipped[0].reason).toContain("di luar pola shift");
  });

  it("hari libur dan alpa tidak menuntut closing", () => {
    const { entries, skipped } = collectClosingPunctuality(
      [
        record({ date: shiftDate(3), status: "HOLIDAY" }),
        record({ date: shiftDate(4), status: "ABSENT" }),
      ],
      config
    );
    expect(entries).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });

  it("memakai default 05:15 + 60 menit bila belum dikonfigurasi", () => {
    const { entries } = collectClosingPunctuality(
      [record({ date: shiftDate(3), checkOut: checkOutAt(3, 6, 30) })],
      null
    );
    expect(entries).toHaveLength(1);
  });

  it("menolak konfigurasi jam yang tidak sah alih-alih diam-diam memakai default", () => {
    expect(() =>
      collectClosingPunctuality([record({ date: shiftDate(3) })], { deadline: "jam 5 pagi" })
    ).toThrow(/tidak sah/);
  });
});

describe("parseClockTime", () => {
  it("menerima format HH:MM", () => {
    expect(parseClockTime("05:15")).toBe(315);
    expect(parseClockTime("5:00")).toBe(300);
    expect(parseClockTime(" 23:59 ")).toBe(1439);
  });

  it("menolak jam atau menit di luar rentang", () => {
    expect(parseClockTime("24:00")).toBeNull();
    expect(parseClockTime("05:60")).toBeNull();
    expect(parseClockTime("0515")).toBeNull();
  });
});

describe("runCollector", () => {
  it("mengarahkan ke kolektor sesuai kuncinya", () => {
    const records = [record({ date: shiftDate(3), status: "LATE" })];
    expect(runCollector("ATTENDANCE_LATE", records).entries).toHaveLength(1);
    expect(runCollector("ATTENDANCE_CLOSING", records).entries).toHaveLength(0);
  });
});
