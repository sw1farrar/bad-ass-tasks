const fs = require("fs");
const p = "features/notes/editor/TipTapEditor.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  /import \{ aiTransformText[^}]+\} from "@\/lib\/utils";\n/,
  ""
);
const marker = "    // ========== M2→M3 BRIDGE AI";
const start = s.indexOf(marker);
if (start < 0) {
  console.error("AI block not found");
  process.exit(1);
}
const before = s.lastIndexOf("    },", start);
const afterEnd = s.indexOf("  ];", start);
s = s.slice(0, before + 6) + "\n" + s.slice(afterEnd);
s = s.replace(
  'const categoryOrder = ["Formatting", "Lists & Structure", "Smart Embeds & Actions", "AI", "Utilities & AI", "Other"];',
  'const categoryOrder = ["Formatting", "Lists & Structure", "Smart Embeds & Actions", "Other"];'
);
fs.writeFileSync(p, s);
console.log("TipTapEditor AI stripped");