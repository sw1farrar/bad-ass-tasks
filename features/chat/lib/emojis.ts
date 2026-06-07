/** Quick reactions shown on every message (Slack-style). */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "💯", "✨"] as const;

export type EmojiCategory = { id: string; label: string; emojis: string[] };

/** Curated modern emoji set (Unicode 15+ style); full color via system fonts. */
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫣", "🤫",
      "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪",
      "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎",
      "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨",
      "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏",
      "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗",
      "💖", "💘", "💝", "💟", "♥️", "💋", "💌", "💐", "🌹", "🥀", "🌺", "🌸", "🌼", "🌻", "🪷", "🏵️",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      "⭐", "🌟", "✨", "💫", "🔥", "💥", "💯", "✅", "❌", "⚠️", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇",
      "📌", "📎", "✏️", "📝", "💼", "📁", "📊", "📈", "🔔", "🔕", "💬", "💭", "🗯️", "👀", "🧠", "💡",
      "☕", "🍕", "🍔", "🌮", "🍩", "🍪", "🎂", "🍾", "🥂", "🍻", "⚽", "🏀", "🎮", "🎧", "📱", "💻",
    ],
  },
  {
    id: "animals",
    label: "Animals",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈",
      "🙉", "🙊", "🐔", "🐧", "🐦", "🐤", "🦄", "🐝", "🦋", "🐌", "🐙", "🦑", "🦀", "🐠", "🐟", "🐬",
    ],
  },
];

export function insertAtCursor(
  el: HTMLTextAreaElement,
  text: string,
  current: string,
  setValue: (v: string) => void
) {
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + text + current.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    const pos = start + text.length;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
}