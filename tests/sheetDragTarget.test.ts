import { describe, expect, it } from "vitest";
import {
  canStartTaskSheetDrag,
  isActiveListDetailDragTarget,
  isListDetailBlankDragTarget,
  isListDetailHeaderDragTarget,
  isListDetailSheetDragTarget,
  isListDetailTitleLabelTarget,
  isSheetBlankDragTarget,
  isSheetDragBlockedTarget,
  isTaskSheetHeaderDragTarget,
} from "@/lib/motion/sheetDragTarget";

function el(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

describe("sheetDragTarget", () => {
  it("blocks interactive controls", () => {
    const button = el('<button type="button">Done</button>');
    expect(isSheetDragBlockedTarget(button)).toBe(true);
  });

  it("allows list row text surfaces", () => {
    const row = el(`
      <div class="list-detail-scroll">
        <div class="list-item-row">
          <div class="list-item-row-content">
            <span class="list-item-text">Buy milk</span>
          </div>
        </div>
      </div>
    `);
    const text = row.querySelector(".list-item-text")!;
    expect(isActiveListDetailDragTarget(text)).toBe(true);
  });

  it("rejects completed section rows", () => {
    const row = el(`
      <div class="list-detail-scroll">
        <div class="list-item-row list-item-row--completed-section">
          <div class="list-item-row-content">
            <span class="list-item-text">Done task</span>
          </div>
        </div>
      </div>
    `);
    const text = row.querySelector(".list-item-text")!;
    expect(isActiveListDetailDragTarget(text)).toBe(false);
  });

  it("allows header title label drag surface", () => {
    const header = el(`
      <div class="list-header-band">
        <header class="list-detail-header">
          <span class="list-detail-title-label">Groceries</span>
        </header>
      </div>
    `);
    const title = header.querySelector(".list-detail-title-label")!;
    expect(isListDetailHeaderDragTarget(title)).toBe(true);
    expect(isListDetailTitleLabelTarget(title)).toBe(true);
  });

  it("rejects header action buttons", () => {
    const header = el(`
      <div class="list-header-band">
        <div class="list-detail-header-actions">
          <button type="button" class="list-header-btn">Menu</button>
        </div>
      </div>
    `);
    const button = header.querySelector("button")!;
    expect(isListDetailHeaderDragTarget(button)).toBe(false);
  });

  it("blank-space swipe allows header and empty scroll, not items or toolbar", () => {
    const sheet = el(`
      <div class="list-detail-modal-surface">
        <div class="list-header-band">
          <span class="list-detail-title-label">Groceries</span>
        </div>
        <div class="list-detail-toolbar list-detail-toolbar--mobile">
          <div class="list-detail-toolbar-filters"></div>
        </div>
        <div class="list-detail-scroll">
          <div class="list-item-row">
            <span class="list-item-text">Buy milk</span>
          </div>
        </div>
      </div>
    `);
    const toolbar = sheet.querySelector(".list-detail-toolbar-filters")!;
    const item = sheet.querySelector(".list-item-text")!;
    const title = sheet.querySelector(".list-detail-title-label")!;
    const scroll = sheet.querySelector(".list-detail-scroll")!;
    expect(isListDetailBlankDragTarget(title)).toBe(true);
    expect(isListDetailBlankDragTarget(scroll)).toBe(false);
    expect(isListDetailBlankDragTarget(toolbar)).toBe(false);
    expect(isListDetailBlankDragTarget(item)).toBe(false);
    expect(isListDetailHeaderDragTarget(title)).toBe(true);
    expect(isListDetailSheetDragTarget(item)).toBe(true);
  });

  it("generic blank-space swipe rejects message bubbles and composers", () => {
    const sheet = el(`
      <div class="chat-drawer-sheet">
        <div class="chat-drawer-header"><div class="font-semibold">Messages</div></div>
        <div class="chat-message-list">
          <div class="chat-message-item"><div class="chat-message-bubble">Hi</div></div>
        </div>
        <div class="chat-composer"><textarea></textarea></div>
      </div>
    `);
    const header = sheet.querySelector(".chat-drawer-header")!;
    const list = sheet.querySelector(".chat-message-list")!;
    const bubble = sheet.querySelector(".chat-message-bubble")!;
    const composer = sheet.querySelector("textarea")!;
    expect(isSheetBlankDragTarget(header)).toBe(true);
    expect(isSheetBlankDragTarget(list)).toBe(true);
    expect(isSheetBlankDragTarget(bubble)).toBe(false);
    expect(isSheetBlankDragTarget(composer)).toBe(false);
  });

  it("allows readonly display-mode item textareas for sheet drag", () => {
    const sheet = el(`
      <div class="list-detail-modal-surface">
        <div class="list-detail-scroll">
          <textarea readonly class="list-item-text list-item-text--editable"></textarea>
        </div>
      </div>
    `);
    const textarea = sheet.querySelector("textarea")!;
    expect(isSheetDragBlockedTarget(textarea)).toBe(false);
  });

  it("allows display-clickable list titles as a drag surface", () => {
    const sheet = el(`
      <div class="list-detail-modal-surface">
        <div class="list-detail-scroll">
          <span class="list-item-text list-item-text--display-clickable">Buy milk</span>
        </div>
      </div>
    `);
    const text = sheet.querySelector(".list-item-text")!;
    expect(isSheetDragBlockedTarget(text)).toBe(false);
    expect(isListDetailSheetDragTarget(text)).toBe(true);
  });

  it("does not arm a sheet drag from task notes or the comment field", () => {
    const sheet = el(`
      <div class="task-detail-modal modal-panel">
        <textarea placeholder="Add notes…">Review the monarch transactions</textarea>
        <input placeholder="Write a comment…" value="follow up" />
        <div class="task-sheet-header">Due date</div>
      </div>
    `);
    const notes = sheet.querySelector("textarea")!;
    const comment = sheet.querySelector("input")!;
    const header = sheet.querySelector(".task-sheet-header")!;
    expect(isSheetDragBlockedTarget(notes)).toBe(true);
    expect(isSheetDragBlockedTarget(comment)).toBe(true);
    expect(isSheetBlankDragTarget(notes)).toBe(false);
    expect(isSheetBlankDragTarget(comment)).toBe(false);
    expect(isSheetBlankDragTarget(header)).toBe(true);
  });

  it("starts a task-sheet drag from the header strip, not from its buttons", () => {
    const sheet = el(`
      <div class="task-detail-modal mobile-bottom-sheet">
        <div class="sheet-drag-handle-zone"><span class="sheet-drag-handle"></span></div>
        <div class="task-sheet-header">
          <div class="flex w-full">
            <div aria-hidden="true"></div>
            <div>
              <button type="button" class="task-star-btn">Star</button>
              <button type="button" class="task-modal-delete-icon-btn">Delete</button>
              <button type="button" class="btn-primary">Done</button>
              <button type="button" class="task-modal-close-icon-btn" aria-label="Close">X</button>
            </div>
          </div>
        </div>
        <div class="task-sheet-body">
          <textarea class="task-detail-title">Buy milk</textarea>
          <textarea class="input">Review the monarch transactions</textarea>
          <input placeholder="Write a comment…" />
          <div class="task-sheet-gap"></div>
        </div>
      </div>
    `);
    const header = sheet.querySelector(".task-sheet-header")!;
    const headerGap = header.querySelector(".flex")!;
    const star = sheet.querySelector(".task-star-btn")!;
    const trash = sheet.querySelector(".task-modal-delete-icon-btn")!;
    const done = sheet.querySelector(".btn-primary")!;
    const close = sheet.querySelector(".task-modal-close-icon-btn")!;
    const title = sheet.querySelector(".task-detail-title")!;
    const notes = sheet.querySelector("textarea.input")!;
    const comment = sheet.querySelector("input")!;
    const bodyGap = sheet.querySelector(".task-sheet-gap")!;

    expect(isTaskSheetHeaderDragTarget(header)).toBe(true);
    expect(isTaskSheetHeaderDragTarget(headerGap)).toBe(true);
    expect(canStartTaskSheetDrag(header)).toBe(true);
    expect(canStartTaskSheetDrag(headerGap)).toBe(true);

    for (const control of [star, trash, done, close]) {
      expect(isTaskSheetHeaderDragTarget(control)).toBe(false);
      expect(canStartTaskSheetDrag(control)).toBe(false);
      expect(isSheetDragBlockedTarget(control)).toBe(true);
    }

    expect(isTaskSheetHeaderDragTarget(notes)).toBe(false);
    expect(canStartTaskSheetDrag(title)).toBe(false);
    expect(canStartTaskSheetDrag(notes)).toBe(false);
    expect(canStartTaskSheetDrag(comment)).toBe(false);
    expect(isSheetDragBlockedTarget(notes)).toBe(true);
    expect(canStartTaskSheetDrag(bodyGap)).toBe(true);
  });

  it("rejects interactive controls anywhere on the sheet surface", () => {
    const sheet = el(`
      <div class="list-detail-modal-surface">
        <div class="list-detail-scroll">
          <button type="button" class="list-item-check">Toggle</button>
        </div>
      </div>
    `);
    const button = sheet.querySelector("button")!;
    expect(isListDetailSheetDragTarget(button)).toBe(false);
  });
});