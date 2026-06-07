const fs = require("fs");
const p = "app/page.tsx";
let s = fs.readFileSync(p, "utf8");

// 1. Remove kanban components only (between VIEWS and export default)
const kStart = s.indexOf("/* =====================================================================\n   Kanban DnD");
const kEnd = s.indexOf("\nexport default function BadAssTasks");
if (kStart >= 0 && kEnd > kStart) {
  s = s.slice(0, kStart) + "\n" + s.slice(kEnd);
}

fs.writeFileSync(p, s);
console.log("removed kanban, lines", s.split(/\n/).length);