import { describe, expect, it } from "vitest";
import {
  isActiveListDetailDragTarget,
  isListDetailHeaderDragTarget,
  isListDetailSheetDragTarget,
  isListDetailTitleLabelTarget,
  isSheetDragBlockedTarget,
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

  it("allows full sheet surface including toolbar and completed rows", () => {
    const sheet = el(`
      <div class="list-detail-modal-surface">
        <div class="list-detail-toolbar list-detail-toolbar--mobile">
          <div class="list-detail-toolbar-filters"></div>
        </div>
        <div class="list-detail-scroll">
          <div class="list-item-row list-item-row--completed-section">
            <span class="list-item-text">Done task</span>
          </div>
        </div>
      </div>
    `);
    const toolbar = sheet.querySelector(".list-detail-toolbar-filters")!;
    const completed = sheet.querySelector(".list-item-text")!;
    expect(isListDetailSheetDragTarget(toolbar)).toBe(true);
    expect(isListDetailSheetDragTarget(completed)).toBe(true);
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