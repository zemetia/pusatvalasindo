import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SiteHeader } from './site-header';

// Mock routing
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));

describe('SiteHeader', () => {
  it('renders navbar logo, Group, Cabang, Blog, and FAQ links', () => {
    render(<SiteHeader />);

    // Brand logo
    expect(screen.getByAltText('Pusat Valas Indo')).toBeDefined();

    // Main nav buttons/links
    expect(screen.getByRole('button', { name: /group/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /cabang/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /^blog$/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /^faq$/i })).toBeDefined();
  });

  it('opens and closes the Group dropdown on click', () => {
    render(<SiteHeader />);

    const groupButton = screen.getByRole('button', { name: /group/i });
    expect(screen.queryByText('PT Pusat Valas Indo')).toBeNull();

    // Click to open Group dropdown
    fireEvent.click(groupButton);
    expect(screen.getByText('PT Pusat Valas Indo')).toBeDefined();
    expect(screen.getByText('PT Pusat Kirim Duit')).toBeDefined();
    expect(screen.getByText('PT Pusat Tukar Uang')).toBeDefined();

    // Click again to close
    fireEvent.click(groupButton);
    expect(screen.queryByText('PT Pusat Valas Indo')).toBeNull();
  });

  it('opens and closes the Cabang dropdown on click', () => {
    render(<SiteHeader />);

    const cabangButton = screen.getByRole('button', { name: /cabang/i });
    expect(screen.queryByText('Cengkareng')).toBeNull();

    // Click to open Cabang dropdown
    fireEvent.click(cabangButton);
    expect(screen.getByText('Cengkareng')).toBeDefined();
    expect(screen.getByText('Tangerang')).toBeDefined();

    // Click again to close
    fireEvent.click(cabangButton);
    expect(screen.queryByText('Cengkareng')).toBeNull();
  });

  it('toggles mobile drawer on hamburger button click', () => {
    render(<SiteHeader />);

    const mobileToggle = screen.getByLabelText(/buka menu navigasi/i);
    fireEvent.click(mobileToggle);

    expect(screen.getByLabelText(/tutup menu/i)).toBeDefined();
    // In mobile menu, check presence of Group and Cabang sections
    expect(screen.getAllByText(/^group$/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/^cabang$/i).length).toBeGreaterThanOrEqual(2);
  });
});
