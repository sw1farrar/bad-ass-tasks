import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ListItemRow } from "@/features/lists/components/ListItemRow";
import type { ListItem } from "@/types";

const item: ListItem = {
  id: "item-1",
  listId: "list-1",
  workspaceId: "ws-1",
  text: "Buy milk",
  completed: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockViewport(mobile: boolean) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: mobile ? 390 : 1280,
  });
  window.matchMedia = ((query: string) => ({
    matches: mobile && query.includes("max-width"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function renderItem(mobile: boolean) {
  mockViewport(mobile);
  render(
    <ListItemRow
      item={item}
      onToggle={() => {}}
      onDelete={() => {}}
      onTextChange={() => {}}
      showEditPencil={mobile}
      clickTitleToEdit={!mobile}
    />,
  );
}

function caretOf(input: HTMLTextAreaElement) {
  return { start: input.selectionStart, end: input.selectionEnd };
}

function pointer(type: "pointerdown" | "pointerup", target: Element) {
  act(() => {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
        clientX: 12,
        clientY: 12,
      }),
    );
  });
}

describe("ListItemRow caret on edit", () => {
  beforeEach(() => {
    mockViewport(false);
  });

  it("places the caret at the end when a mobile item is tapped", () => {
    renderItem(true);
    const label = screen.getByText("Buy milk");
    pointer("pointerdown", label);
    pointer("pointerup", label);

    const input = screen.getByRole("textbox", { name: "List item" }) as HTMLTextAreaElement;
    expect(caretOf(input)).toEqual({ start: item.text.length, end: item.text.length });
  });

  it("selects the whole item when a desktop item is tapped", () => {
    renderItem(false);
    pointer("pointerdown", screen.getByText("Buy milk"));

    const input = screen.getByRole("textbox", { name: "List item" }) as HTMLTextAreaElement;
    expect(caretOf(input)).toEqual({ start: 0, end: item.text.length });
  });
});
