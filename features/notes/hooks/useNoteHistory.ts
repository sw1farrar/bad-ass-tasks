import { useCallback } from "react";

interface UseNoteHistoryProps {
  selectedNoteId: string | null;
  onRequestSnapshot?: (label: string) => void;
  onRequestTitleSnapshot?: () => void;
}

/**
 * Coordinates version-history snapshot triggers from Notes UI → editor capture.
 * Parent wires onRequestSnapshot to TipTap capture; this hook keeps call sites stable.
 */
export function useNoteHistory({
  selectedNoteId: _selectedNoteId,
  onRequestSnapshot,
  onRequestTitleSnapshot,
}: UseNoteHistoryProps) {
  const requestSnapshot = useCallback(
    (label = "Manual") => {
      onRequestSnapshot?.(label);
    },
    [onRequestSnapshot]
  );

  const requestTitleSnapshot = useCallback(() => {
    onRequestTitleSnapshot?.();
  }, [onRequestTitleSnapshot]);

  return { requestSnapshot, requestTitleSnapshot };
}