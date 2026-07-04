import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  extractReceiptLineItemsFromEmailHtml,
  extractReceiptLineItemsFromPlainBody,
  extractRetailSkuReceiptRows,
  extractReceiptRowsFromHtmlTables,
  extractReceiptRowsFromPlainText,
  formatEmailReceiptLinesForPrompt,
} from "@/lib/files/extractEmailReceiptLineItems";

const microCenterReceipt = readFileSync(
  join(__dirname, "fixtures", "microCenterReceipt.txt"),
  "utf8",
);

describe("extractEmailReceiptLineItems", () => {
  it("extracts rows from HTML receipt tables", () => {
    const html = `
      <table>
        <tr><td>Widget Pro</td><td class="amount">$19.99</td></tr>
        <tr><td>USB-C Cable</td><td>$12.99</td></tr>
        <tr><td>Subtotal</td><td>$32.98</td></tr>
        <tr><td>Tax</td><td>$2.64</td></tr>
      </table>
    `;

    const items = extractReceiptRowsFromHtmlTables(html);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ itemName: "Widget Pro", pricePaid: 19.99 });
    expect(items[1]).toMatchObject({ itemName: "USB-C Cable", pricePaid: 12.99 });
  });

  it("extracts inline priced lines from plain text", () => {
    const text = `
      Order summary
      Standing Desk $449.00
      Monitor Arm $89.99
      Total $538.99
    `;

    const items = extractReceiptRowsFromPlainText(text);
    expect(items.some((item) => item.itemName.includes("Standing Desk"))).toBe(true);
    expect(items.some((item) => item.itemName.includes("Monitor Arm"))).toBe(true);
    expect(items.some((item) => item.itemName.toLowerCase() === "total")).toBe(false);
  });

  it("merges table and plain-text extraction for full email HTML", () => {
    const html = `
      <html><body>
        <h1>Thanks for your order</h1>
        <table>
          <tr><td>Organic Oat Milk (6-pack)</td><td>$8.49</td></tr>
          <tr><td>Avocados (4 ct)</td><td>$5.99</td></tr>
        </table>
        <p>Need help? Visit support.</p>
      </body></html>
    `;

    const items = extractReceiptLineItemsFromEmailHtml(html);
    expect(items).toHaveLength(2);
    expect(formatEmailReceiptLinesForPrompt(items)).toContain("Organic Oat Milk");
    expect(formatEmailReceiptLinesForPrompt(items)).toContain("$5.99");
  });

  it("returns empty for non-receipt marketing email", () => {
    const html = "<p>Check out our summer sale — up to 50% off!</p>";
    expect(extractReceiptLineItemsFromEmailHtml(html)).toEqual([]);
  });

  it("extracts every Micro Center SKU line from a columnar receipt", () => {
    const items = extractRetailSkuReceiptRows(microCenterReceipt);
    expect(items.length).toBeGreaterThanOrEqual(10);

    const names = items.map((item) => item.itemName.toLowerCase());
    expect(names.some((n) => n.includes("gigabyte z890"))).toBe(true);
    expect(names.some((n) => n.includes("lianli lancool"))).toBe(true);
    expect(names.some((n) => n.includes("corsair 32gb"))).toBe(true);
    expect(names.some((n) => n.includes("rtx5070ti") || n.includes("rtx 5070"))).toBe(true);

    const prices = items.map((item) => item.pricePaid).filter((p) => p != null);
    expect(prices).toContain(999.99);
    expect(prices).toContain(191.16);
    expect(prices).not.toContain(2769.94);
    expect(prices).not.toContain(2984.61);
  });

  it("extracts Micro Center items from collapsed HTML email bodies", () => {
    const collapsed = `<p>${microCenterReceipt.replace(/\n/g, " ")}</p>`;
    const items = extractReceiptLineItemsFromEmailHtml(collapsed);
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items.some((item) => item.itemName.toLowerCase().includes("intel core ultra"))).toBe(
      true,
    );
  });

  it("extracts Micro Center items from plain search text fallback", () => {
    const items = extractReceiptLineItemsFromPlainBody(microCenterReceipt);
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(formatEmailReceiptLinesForPrompt(items)).toContain("$387.37");
  });

  it("does not double-count warranty footer SKU repeats", () => {
    const withFooter = `${microCenterReceipt}\n\n081042/ KB AUTO KB SALES CHECK-OUT\n768879/ GIGABYTE Z890 AORUS PRO ICE`;
    const items = extractRetailSkuReceiptRows(withFooter);
    const gigabyte = items.filter((item) =>
      item.itemName.toLowerCase().includes("gigabyte z890"),
    );
    expect(gigabyte).toHaveLength(1);
  });
});