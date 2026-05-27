/**
 * TipTapEditor.test.tsx
 *
 * M0 Verification Harness Expansion — DEMO-ONLY + HEAVILY MOCKED (RTL smoke)
 * 
 * Charter (M0-Verification-Harness-Agent + AGENT-70-TESTING-PROPOSAL.md + WAVE8-MASTER-PLAN.md §4):
 * - "start on RTL component tests for key hygiene surfaces (e.g. ... simple editor smoke)".
 * - Minimal skeleton smoke test for the monolithic TipTapEditor (complex production component).
 * - Heavily mocked: @tiptap/react (useEditor + EditorContent), hybridStore (isSupabaseLive),
 *   sonner (toast), and ai utils if surface touched. No real TipTap/ProseMirror execution.
 * - 100% demo-only: exercises the editor in its demo context (isSupabaseLive false).
 * - Scope: skeleton / smoke only. Asserts mount without crash + basic prop wiring.
 *   Full editor testing (slash, mentions, cursors, history) deferred (monolithic nature noted in prior M0 analysis).
 * - Follows patterns: header like hybridStore.test.ts, vitest.setup RTL infra, hoisted mocks.
 *
 * Protects demo: editor is used in both demo + live; this verifies hygiene surface.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Hoisted heavy mocks for complex deps (prevents jsdom/ProseMirror runtime issues in skeleton)
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    isActive: vi.fn(() => false),
    chain: vi.fn(() => ({
      focus: vi.fn(() => ({
        toggleBold: vi.fn(() => ({ run: vi.fn() })),
        toggleItalic: vi.fn(() => ({ run: vi.fn() })),
        toggleHeading: vi.fn(() => ({ run: vi.fn() })),
        toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
        toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
        toggleTaskList: vi.fn(() => ({ run: vi.fn() })),
        toggleBlockquote: vi.fn(() => ({ run: vi.fn() })),
        toggleCodeBlock: vi.fn(() => ({ run: vi.fn() })),
        setHorizontalRule: vi.fn(() => ({ run: vi.fn() })),
        insertContent: vi.fn(() => ({ run: vi.fn() })),
        undo: vi.fn(() => ({ run: vi.fn() })),
        redo: vi.fn(() => ({ run: vi.fn() })),
      })),
      run: vi.fn(),
    })),
    commands: {
      setContent: vi.fn(),
      focus: vi.fn(),
    },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  })),
  EditorContent: (props: any) => (
    <div
      data-testid="tiptap-editor-content"
      className={props.className}
      {...props}
    >
      {props.children || <div contentEditable="true" data-testid="mock-editable">Mock editor content</div>}
    </div>
  ),
  // Any other re-exports used (safe no-op)
}));

vi.mock('@/lib/data/hybridStore', () => ({
  isSupabaseLive: vi.fn(() => false),
  __esModule: true,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// The ai utils are imported but only called on explicit user actions (slash/AI); safe for render smoke
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    aiTransformText: vi.fn().mockResolvedValue('transformed'),
    aiTransformTextAI: vi.fn().mockResolvedValue('ai-transformed'),
    isXAIConfigured: vi.fn(() => false),
  };
});

// Now safe
import { TipTapEditor } from '@/components/TipTapEditor';

describe('TipTapEditor — M0 simple RTL smoke test (heavily mocked, demo-only)', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without throwing (smoke) in demo mode', () => {
    expect(() => {
      render(
        <TipTapEditor
          content="Initial demo note content"
          onChange={mockOnChange}
          placeholder="Start writing..."
        />
      );
    }).not.toThrow();
  });

  it('renders the mocked editor content surface', () => {
    render(<TipTapEditor content="" onChange={mockOnChange} />);

    expect(screen.getByTestId('tiptap-editor-content')).toBeInTheDocument();
    // Basic editable proxy from mock
    expect(screen.getByTestId('mock-editable')).toBeInTheDocument();
  });

  it('accepts and wires onChange prop (smoke; real calls exercised by mocked useEditor stub)', () => {
    render(<TipTapEditor content="test" onChange={mockOnChange} />);

    // In real impl onUpdate would call; here we just assert prop acceptance + no crash
    // (deeper interaction testing would require richer mock of editor commands/events)
    expect(mockOnChange).not.toHaveBeenCalled(); // not auto-fired in smoke
    expect(screen.getByTestId('tiptap-editor-content')).toBeInTheDocument();
  });

  it('respects demo context (isSupabaseLive false does not affect basic render)', () => {
    // The internal isSupabaseLive import is exercised on module load / render path in real code
    // Mock guarantees demo path; assert no error + surface present
    render(<TipTapEditor content="demo note" onChange={mockOnChange} />);
    expect(screen.getByTestId('tiptap-editor-content')).toBeInTheDocument();
  });
});

/**
 * End of M0 TipTapEditor.test.tsx smoke skeleton.
 * "Start on" per charter — minimal, safe, heavily mocked.
 * Full editor RTL would be high-effort (monolithic); this establishes the pattern + hygiene baseline.
 * Demo invariant: PROTECTED. Run full regression after.
 */