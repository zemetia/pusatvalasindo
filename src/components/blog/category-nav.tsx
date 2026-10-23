import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export interface CategoryNavItem {
  slug: string;
  name: string;
  count: number;
}

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-red-700";

/**
 * Navigasi kategori blog. Sengaja tautan biasa (bukan filter ?query) supaya tiap
 * kategori punya URL sendiri yang bisa dirayapi dan diindeks.
 * `active` = slug kategori yang sedang dibuka; kosong berarti "Semua".
 */
export function CategoryNav({
  categories,
  active,
  className,
}: {
  categories: CategoryNavItem[];
  active?: string;
  className?: string;
}) {
  if (categories.length === 0) return null;

  const chip = (isActive: boolean) =>
    cn(
      CHIP,
      isActive
        ? "border-lp-red-700 bg-lp-red-700 text-white"
        : "border-lp-line bg-lp-paper text-lp-ink-soft hover:border-lp-red-700 hover:text-lp-red-700"
    );

  return (
    <nav aria-label="Kategori artikel" className={className}>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="/blog" aria-current={active ? undefined : "page"} className={chip(!active)}>
            Semua
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/blog/kategori/${c.slug}`}
              aria-current={active === c.slug ? "page" : undefined}
              className={chip(active === c.slug)}
            >
              {c.name}
              <span className="tabular text-xs opacity-75">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
