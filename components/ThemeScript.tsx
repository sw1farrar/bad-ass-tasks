import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/themePreferences";

/** Blocking script to apply persisted theme before first paint (prevents flash). */
export function ThemeScript() {
  const script = `(function(){try{var m=localStorage.getItem("${THEME_STORAGE_KEY}");if(m!=="light"&&m!=="dark"){var s=localStorage.getItem("badazz-tasks-storage");if(s){var p=JSON.parse(s);m=p&&p.state&&p.state.theme;}}if(m!=="light"&&m!=="dark")m="${DEFAULT_THEME}";var r=document.documentElement;r.dataset.theme=m;r.classList.toggle("dark",m==="dark");r.style.colorScheme=m;}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}";document.documentElement.classList.add("dark");}})();`;

  return (
    <script
      id="badazz-theme-script"
      // Theme must run before paint; extensions may mutate this node — ignore hydration drift.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}