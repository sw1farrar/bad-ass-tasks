import { describe, expect, it } from "vitest";
import {
  isActiveListDetailDragTarget,
  isListDetailHeaderDragTarget,
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
});