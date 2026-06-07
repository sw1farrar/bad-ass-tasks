/**
 * SupabaseSetupBanner.test.tsx
 *
 * M0 Verification Harness Expansion — DEMO-ONLY + HEAVILY MOCKED (RTL)
 * 
 * Charter (M0-Verification-Harness-Agent + AGENT-70-TESTING-PROPOSAL.md § "Component / Integration Tests"):
 * - RTL component test for key hygiene surface: SupabaseSetupBanner.
 * - Heavily mocks the isSupabaseConfigured dependency (from @/lib/supabase/client).
 * - 100% demo-only: tests the exact conditional render + dismiss UX that protects users in !configured (demo) mode.
 * - Covers: visible when !configured && !dismissed; hidden when configured or after dismiss click.
 * - Follows documented patterns (hybridStore.test.ts style header, vitest.setup.ts RTL + jest-dom + cleanup + localStorage mocks).
 * - No real env, no network, isolated.
 *
 * This is the first RTL hygiene test per M0 charter ("start on RTL component tests for key hygiene surfaces (e.g. SupabaseSetupBanner...)").
 * Protects demo experience: banner only shows appropriately in demo.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupabaseSetupBanner } from '@/components/SupabaseSetupBanner';

// Hoisted mock for the exact import used by the component
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: vi.fn(() => false),
  __esModule: true,
}));

// Re-import the mocked fn for control in tests
import { isSupabaseConfigured } from '@/lib/supabase/client';

describe('SupabaseSetupBanner — M0 RTL hygiene surface test (demo-only, conditional render + dismiss)', () => {
  let mockIsConfigured: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured = vi.mocked(isSupabaseConfigured);
    // Default: demo / not configured (the primary path the banner protects)
    mockIsConfigured.mockReturnValue(false);
  });

  it('renders the banner when !isSupabaseConfigured() and not dismissed', () => {
    render(<SupabaseSetupBanner />);

    expect(screen.getByText(/Connect to Supabase for real data/i)).toBeInTheDocument();
    expect(screen.getByText(/Auth, teams, cross-device sync/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Dismiss Supabase setup banner for now/i })).toBeInTheDocument();
    expect(screen.getByText(/Create project/i)).toBeInTheDocument();
  });

  it('does not render (returns null) when isSupabaseConfigured() is true', () => {
    mockIsConfigured.mockReturnValue(true);

    const { container } = render(<SupabaseSetupBanner />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Connect to Supabase for real data/i)).not.toBeInTheDocument();
  });

  it('dismisses the banner on "Dismiss for now" button click (hides and stays hidden)', () => {
    render(<SupabaseSetupBanner />);

    const dismissBtn = screen.getByRole('button', { name: /Dismiss Supabase setup banner for now/i });
    fireEvent.click(dismissBtn);

    // After dismiss, banner gone
    expect(screen.queryByText(/Connect to Supabase for real data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dismiss for now/i)).not.toBeInTheDocument();
  });

  it('also dismisses via the ✕ close button (aria-label)', () => {
    render(<SupabaseSetupBanner />);

    // Use exact aria-label from component DOM (avoids multiple button match)
    const closeBtn = screen.getByRole('button', { name: 'Dismiss Supabase setup banner' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Connect to Supabase for real data/i)).not.toBeInTheDocument();
  });

  it('re-render after dismiss still respects internal dismissed state (no re-show without remount/config change)', () => {
    const { rerender } = render(<SupabaseSetupBanner />);

    const dismissBtn = screen.getByRole('button', { name: /Dismiss Supabase setup banner for now/i });
    fireEvent.click(dismissBtn);

    // Force re-render (simulates parent state change without config change)
    rerender(<SupabaseSetupBanner />);

    expect(screen.queryByText(/Connect to Supabase for real data/i)).not.toBeInTheDocument();
  });
});

/**
 * End of M0 SupabaseSetupBanner.test.tsx skeleton.
 * Heavily mocked, RTL + jest-dom assertions, follows setup.ts.
 * Demo invariant protected. Part of key hygiene surfaces per charter.
 */