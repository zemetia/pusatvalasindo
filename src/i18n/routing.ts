import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'id'],

  // Used when no locale matches
  defaultLocale: 'id',

  // Indonesia tanpa prefix (/), Inggris di /en
  localePrefix: 'as-needed',

  // "/" selalu Indonesia; jangan dialihkan ke /en berdasarkan Accept-Language
  // (crawler & pengunjung harus melihat satu URL kanonis per bahasa)
  localeDetection: false
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
