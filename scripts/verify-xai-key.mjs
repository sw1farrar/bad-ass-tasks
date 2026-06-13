import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const key = envText.match(/^XAI_API_KEY=(.+)$/m)?.[1]?.trim();

if (!key) {
  console.error("FAIL: XAI_API_KEY not found in .env.local");
  process.exit(1);
}

const placeholders = new Set([
  "",
  "paste_your_xai_key_here",
  "xai-your-api-key-here",
  "your-api-key-here",
]);

if (placeholders.has(key.toLowerCase())) {
  console.error("FAIL: XAI_API_KEY is still the placeholder");
  process.exit(1);
}

console.log(`OK: key present (${key.length} chars, starts with ${key.slice(0, 8)}...)`);

const res = await fetch("https://api.x.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.XAI_MODEL?.trim() || "grok-4.3",
    messages: [{ role: "user", content: 'Reply JSON only: {"ok":true}' }],
    max_tokens: 20,
    response_format: { type: "json_object" },
    temperature: 0,
  }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`FAIL: Grok API HTTP ${res.status}`);
  console.error(body.slice(0, 300));
  process.exit(1);
}

console.log(`OK: Grok API accepted the key (HTTP ${res.status})`);