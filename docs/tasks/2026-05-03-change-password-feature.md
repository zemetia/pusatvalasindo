# Task: Change User Password Feature

- **Date**: 2026-05-03
- **Status**: In Progress
- **Source**: User request for password change settings

## 🎯 Goal

Implement a "Change Password" feature in the user account settings. This allows logged-in users to update their password securely by providing their current password and a new password.

## 📋 Implementation Checklist

- [x] **Phase 1: Research & Discovery**
  - [x] Step 1.1: Verify BetterAuth `changePassword` API requirements. (Requires `currentPassword`, `newPassword`, and optionally `revokeOtherSessions`).
  - [x] Step 1.2: Check existing UI components (Input, Button, Label, Sonner) for form building.
  - [x] Step 1.3: Confirm if any localization is needed for the new strings.

- [x] **Phase 2: UI Implementation**
  - [x] Step 2.1: Create a `ChangePasswordForm` component in `components/account/change-password-form.tsx`.
  - [x] Step 2.2: Implement fields: Current Password, New Password, Confirm New Password.
  - [x] Step 2.3: Add client-side validation (matching passwords, minimum length).
  - [x] Step 2.4: Integrate the form into `app/[locale]/(dashboard)/dashboard/account/page.tsx`.

- [x] **Phase 3: Logic Implementation**
  - [x] Step 3.1: Connect form submission to `authClient.changePassword`.
  - [x] Step 3.2: Implement loading states and error handling.
  - [x] Step 3.3: Add success notification using `sonner`.
  - [x] Step 3.4: Reset form fields upon successful password change.

- [x] **Phase 4: Testing & Verification**
  - [x] Step 4.1: Test with incorrect current password (should fail).
  - [x] Step 4.2: Test with mismatched new passwords (should fail client-side).
  - [x] Step 4.3: Test successful password change.
  - [x] Step 4.4: Verify login with the new password after logout.

## 🛠️ Technical Details

- **Files affected**:
  - `app/[locale]/(dashboard)/dashboard/account/page.tsx`
  - `components/account/change-password-form.tsx` (new)
- **Dependencies**:
  - `better-auth/react` (authClient)
  - `sonner` (toasts)
  - `@tabler/icons-react` (icons)

## 📝 Notes & Discoveries

- BetterAuth's `changePassword` is the standard way to handle this.
- We should ensure the "Reset password" link in the current page is either removed or pointed to a proper flow if forgot password is implemented separately.
