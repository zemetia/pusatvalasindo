import { describe, expect, it } from "vitest";
import { haversineKm } from "@/app/api/attendance/route";

describe("attendance geofence & haversine calculation", () => {
  it("menghitung jarak 0 untuk titik koordinat yang sama", () => {
    const lat = -6.2088;
    const lng = 106.8456;
    expect(haversineKm(lat, lng, lat, lng)).toBe(0);
  });

  it("menghitung jarak dalam meter secara akurat", () => {
    // Monas (-6.1754, 106.8272) ke Bundaran HI (-6.1950, 106.8230) ~ 2.22 km
    const distKm = haversineKm(-6.1754, 106.8272, -6.1950, 106.8230);
    const distM = distKm * 1000;
    expect(distM).toBeGreaterThan(2100);
    expect(distM).toBeLessThan(2300);
  });

  it("mencocokkan cabang jika checkout berada dalam radius absensi", () => {
    const branches = [
      { id: "b1", name: "Cabang Thamrin", latitude: -6.1950, longitude: 106.8230, radiusM: 30 },
      { id: "b2", name: "Cabang Sudirman", latitude: -6.2150, longitude: 106.8150, radiusM: 25 },
    ];

    // User berada tepat di koordinat Cabang Thamrin
    const userLat = -6.1950;
    const userLng = 106.8230;

    const withDistance = branches.map((b) => ({
      ...b,
      distM: haversineKm(userLat, userLng, b.latitude, b.longitude) * 1000,
    })).sort((a, b) => a.distM - b.distM);

    const nearest = withDistance[0];
    const matched = withDistance.find((b) => b.distM <= b.radiusM);

    expect(nearest.id).toBe("b1");
    expect(matched?.id).toBe("b1");
  });

  it("menolak checkout jika berada di luar radius semua cabang", () => {
    const branches = [
      { id: "b1", name: "Cabang Thamrin", latitude: -6.1950, longitude: 106.8230, radiusM: 30 },
      { id: "b2", name: "Cabang Sudirman", latitude: -6.2150, longitude: 106.8150, radiusM: 25 },
    ];

    // User berada 500 meter dari Cabang Thamrin
    const userLat = -6.2000;
    const userLng = 106.8230;

    const withDistance = branches.map((b) => ({
      ...b,
      distM: haversineKm(userLat, userLng, b.latitude, b.longitude) * 1000,
    })).sort((a, b) => a.distM - b.distM);

    const nearest = withDistance[0];
    const matched = withDistance.find((b) => b.distM <= b.radiusM);

    expect(matched).toBeUndefined();
    expect(nearest.distM).toBeGreaterThan(30);
  });

  it("mencocokkan cabang dengan radius lebih besar meski cabang lain lebih dekat secara fisik", () => {
    // b1 berjarak 25m tapi radiusnya cuma 20m (di luar radius)
    // b2 berjarak 35m tapi radiusnya 50m (di dalam radius)
    const baseLat = -6.2000;
    const baseLng = 106.8000;

    // 1 derajat lat ~ 111 km = 111,000 m => 0.000225 deg ~ 25m
    const offsetLat25m = baseLat + (25 / 111000);
    const offsetLat35m = baseLat + (35 / 111000);

    const branches = [
      { id: "b1", name: "Cabang Kecil", latitude: offsetLat25m, longitude: baseLng, radiusM: 20 },
      { id: "b2", name: "Cabang Besar", latitude: offsetLat35m, longitude: baseLng, radiusM: 50 },
    ];

    const withDistance = branches.map((b) => ({
      ...b,
      distM: haversineKm(baseLat, baseLng, b.latitude, b.longitude) * 1000,
    })).sort((a, b) => a.distM - b.distM);

    const nearest = withDistance[0];
    const matched = withDistance.find((b) => b.distM <= b.radiusM);

    // Cabang terdekat fisik adalah b1 (~25m), tetapi user masuk di radius b2 (~35m <= 50m)
    expect(nearest.id).toBe("b1");
    expect(matched?.id).toBe("b2");
  });

  it("mengabaikan cabang yang tidak memiliki koordinat latitude / longitude", () => {
    const rawBranches: Array<{ id: string; name: string; latitude: number | null; longitude: number | null; attendanceRadiusM: number | null }> = [
      { id: "b1", name: "Cabang Tanpa Koordinat", latitude: null, longitude: null, attendanceRadiusM: 20 },
      { id: "b2", name: "Cabang Valid", latitude: -6.2000, longitude: 106.8000, attendanceRadiusM: 25 },
    ];

    const validBranches = rawBranches.filter(
      (b): b is typeof b & { latitude: number; longitude: number } =>
        b.latitude !== null && b.longitude !== null
    );

    expect(validBranches).toHaveLength(1);
    expect(validBranches[0].id).toBe("b2");

    const distM = haversineKm(-6.2000, 106.8000, validBranches[0].latitude, validBranches[0].longitude) * 1000;
    expect(distM).toBe(0);
  });
});
