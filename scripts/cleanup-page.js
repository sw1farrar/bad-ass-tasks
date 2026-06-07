const fs = require("fs");
let s = fs.readFileSync("app/page.tsx", "utf8");

const removals = [
  /\s*const handleQuickAdd = async \(e: React\.FormEvent\) => \{[\s\S]*?\};\n/g,
  /\s*const handleAddFromNatural = async \(\) => \{[\s\S]*?\};\n/g,
  /\s*const handleRefreshActivity = async \(\) => \{[\s\S]*?\};\n/g,
  /\s*\{\/\* Agent 32: The Knowledge Graph[\s\S]*?<\/KnowledgeGraph>\n/g,
  /\s*\{\/\* Mobile FAB[\s\S]*?<\/button>\n/g,
  /\s*\{\/\* Floating Quick Add Bar[\s\S]*?<\/AnimatePresence>\n/g,
  /\s*\{\/\* Floating AI button[\s\S]*?\{showAIChat && <AIChatPanel[\s\S]*?\/>\}\n/g,
  /\s*<button onClick=\{handleAddFromNatural\} className="btn btn-primary[^>]*>[\s\S]*?<\/button>\n/g,
];

for (const re of removals) s = s.replace(re, "\n");

// Keyboard handler quick add block
s = s.replace(
  /\s*\/\/ Quick add \(.*?\n[\s\S]*?return;\n      \}\n/,
  "\n"
);
s = s.replace(/if \(showAIChat\) \{[\s\S]*?\}\n/g, "");
s = s.replace(/if \(showAddInput\) \{[\s\S]*?\}\n/g, "");
s = s.replace(/!showAddInput && /g, "");
s = s.replace(/showAddInput,\n/g, "");
s = s.replace(/showAIChat,\n/g, "");

// Right panel
const ctxStart = s.indexOf("        {/* Right Context Panel */}");
const ctxEnd = s.indexOf("      </div>\n\n      {/* Mobile Bottom Navigation", ctxStart);
if (ctxStart >= 0 && ctxEnd > ctxStart) {
  const chat = `        <aside className="hidden xl:flex w-80 border-l border-white/10 flex-col bg-[#0a0a0f] min-h-0">
          <div className="flex-1 min-h-0 p-4 flex flex-col">
            <WorkspaceChatPanel
              workspaceId={currentWorkspace.id}
              workspaceName={currentWorkspace.name}
              userId={user?.id}
              members={members}
            />
          </div>
        </aside>`;
  s = s.slice(0, ctxStart) + chat + s.slice(ctxEnd);
}

if (!s.includes("ChatDrawer")) {
  s = s.replace(
    "{/* Command Palette */}",
    `{<ChatDrawer
        open={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        workspaceId={currentWorkspace.id}
        workspaceName={currentWorkspace.name}
        userId={user?.id}
        members={members}
      />}

      {/* Command Palette */}`
  );
}

if (!s.includes("setShowChatDrawer(true)")) {
  s = s.replace(
    /(<div\s+onClick=\{\(\) => toggleCommandPalette\(true\)\}[\s\S]*?<\/div>)/,
    `$1

          <button
            type="button"
            onClick={() => setShowChatDrawer(true)}
            className="xl:hidden flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 hover:border-[#c084fc]/40 text-[#a1a1aa] hover:text-white"
            aria-label="Open team chat"
          >
            <MessageCircle className="h-4 w-4" />
          </button>`
  );
}

// Today inline AI buttons in renderTodayView - remove briefing buttons block
s = s.replace(
  /<button[\s\S]*?AI Briefing[\s\S]*?<\/button>\s*<button[\s\S]*?Weekly[\s\S]*?<\/button>/g,
  ""
);

fs.writeFileSync("app/page.tsx", s);
console.log("cleanup done", s.split(/\n/).length);