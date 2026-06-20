# Task: Create Employee Attendance (Absent) Page

- **Date**: 2026-05-12
- **Status**: In Progress
- **Source**: User request for per-user attendance page

## 🎯 Goal

Create a dedicated attendance page for employees to clock in and clock out. The page should capture GPS location, a check-in photo, and maintain a history of attendance records.

## 📋 Implementation Checklist

### Phase 1: Research & Backend Updates
- [x] **Step 1.1**: Analyze existing `Attendance` schema and `api/attendance` route.
- [x] **Step 1.2**: Verify `app/api/attendance/route.ts` is robust for check-in only (date validation, unique constraints).
- [x] **Step 1.3**: Verify photo upload logic (`api/attendance/upload/route.ts`) and compression utility (`lib/image-compress.ts`).

### Phase 2: UI Components Development
- [x] **Step 2.1**: Create `components/attendance/live-clock.tsx` for real-time display.
- [x] **Step 2.2**: Create `components/attendance/camera-capture.tsx` for taking check-in photos.
- [x] **Step 2.3**: Create `components/attendance/location-status.tsx` to show current GPS status.
- [x] **Step 2.4**: Create `components/attendance/attendance-history.tsx` to list past records.

### Phase 3: Main Page Implementation
- [x] **Step 3.1**: Create `app/[locale]/(dashboard)/dashboard/attendance/page.tsx`.
- [x] **Step 3.2**: Implement `AttendanceClient` component to manage state (loading, today's status, camera toggle).
- [x] **Step 3.3**: Integrate clock-in action with image compression and Supabase upload.
- [x] **Step 3.4**: Ensure responsive design for mobile users.

### Phase 4: Navigation & Integration
- [x] **Step 4.1**: Add "Presensi" menu item to `components/app-sidebar.tsx`.
- [x] **Step 4.2**: Localize strings (ID/EN) for the new page.

### Phase 5: Verification & Polish
- [ ] **Step 5.1**: Test GPS spoofing detection (distance check).
- [ ] **Step 5.2**: Verify `LATE` vs `PRESENT` status logic.
- [ ] **Step 5.3**: Audit UI for premium aesthetic (vibrant colors, smooth transitions).

## 🛠️ Technical Details

- **Files affected**:
  - `prisma/schema/attendance.prisma`
  - `app/api/attendance/route.ts`
  - `app/[locale]/(dashboard)/dashboard/attendance/page.tsx`
  - `components/app-sidebar.tsx`
- **Dependencies**: 
  - Browser Geolocation API
  - MediaDevices API (Camera)
  - `@tabler/icons-react`
  - `lib/image-compress.ts` (for photo resizing)
  - `lib/supabase.ts` (for storage)

## 📝 Notes & Discoveries

- Current `api/attendance/route.ts` has hardcoded work hours (17:40). This should probably be moved to a configuration file or branch setting later.
- The `upsert` logic in the API is good for handling re-attempts but needs to distinguish between "new check-in" and "check-out".
