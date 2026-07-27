/** Quick reactions shown on every message (Slack-style). */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "💯", "✨"] as const;

export type EmojiEntry = {
  emoji: string;
  /** Search terms: name, emotion, description */
  keywords: string[];
};

export type EmojiCategory = {
  id: string;
  label: string;
  emojis: EmojiEntry[];
};

function e(emoji: string, ...keywords: string[]): EmojiEntry {
  return { emoji, keywords };
}

/** Curated modern emoji set with searchable keywords. */
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      e("😀", "grinning", "happy", "smile", "joy"),
      e("😃", "grinning", "happy", "smile", "big"),
      e("😄", "grinning", "happy", "smile", "laugh"),
      e("😁", "beaming", "happy", "smile", "teeth"),
      e("😆", "laughing", "happy", "squint", "lol"),
      e("😅", "sweat", "nervous", "relief", "awkward"),
      e("🤣", "rofl", "laughing", "rolling", "hilarious"),
      e("😂", "tears", "joy", "laugh", "crying laughing", "lol"),
      e("🙂", "slight smile", "happy", "content"),
      e("🙃", "upside down", "sarcasm", "silly"),
      e("😉", "wink", "flirt", "joke"),
      e("😊", "blush", "happy", "warm", "smile"),
      e("😇", "angel", "innocent", "halo"),
      e("🥰", "love", "hearts", "adore", "crush"),
      e("😍", "heart eyes", "love", "crush", "adore"),
      e("🤩", "star eyes", "excited", "wow", "amazed"),
      e("😘", "kiss", "blow kiss", "love", "flirt"),
      e("😗", "kiss", "whistle"),
      e("😚", "kiss", "closed eyes"),
      e("😙", "kiss", "smile"),
      e("🥲", "tear", "grateful", "touched", "bittersweet"),
      e("😋", "yum", "delicious", "tongue", "hungry"),
      e("😛", "tongue", "playful", "silly"),
      e("😜", "wink tongue", "playful", "joke"),
      e("🤪", "zany", "crazy", "wild", "goofy"),
      e("😝", "tongue", "squint", "playful"),
      e("🤑", "money", "rich", "dollar", "greedy"),
      e("🤗", "hug", "hugging", "care", "warm"),
      e("🤭", "oops", "giggle", "secret", "hand over mouth"),
      e("🫢", "shock", "surprise", "gasp"),
      e("🫣", "peek", "shy", "nervous", "hide"),
      e("🤫", "shush", "quiet", "secret", "silence"),
      e("🤔", "thinking", "hmm", "consider", "wonder"),
      e("🫡", "salute", "respect", "yes sir"),
      e("🤐", "zipped", "secret", "quiet", "sealed lips"),
      e("🤨", "raised eyebrow", "skeptical", "doubt", "suspicious"),
      e("😐", "neutral", "meh", "blank"),
      e("😑", "expressionless", "meh", "deadpan"),
      e("😶", "no mouth", "speechless", "silent"),
      e("🫥", "dotted", "invisible", "fade", "hidden"),
      e("😏", "smirk", "sly", "flirt", "smug"),
      e("😒", "unamused", "annoyed", "side eye"),
      e("🙄", "eye roll", "whatever", "annoyed", "sarcasm"),
      e("😬", "grimace", "awkward", "oops", "cringe"),
      e("🤥", "lying", "pinocchio", "liar"),
      e("😌", "relieved", "calm", "peaceful", "content"),
      e("😔", "pensive", "sad", "down", "disappointed"),
      e("😪", "sleepy", "tired", "drowsy"),
      e("🤤", "drool", "hungry", "desire"),
      e("😴", "sleep", "zzz", "tired", "rest"),
      e("😷", "mask", "sick", "ill", "covid"),
      e("🤒", "thermometer", "sick", "fever", "ill"),
      e("🤕", "bandage", "hurt", "injured", "headache"),
      e("🤢", "nauseated", "sick", "gross", "green"),
      e("🤮", "vomit", "sick", "puke", "ill"),
      e("🥵", "hot", "heat", "sweating", "spicy"),
      e("🥶", "cold", "freezing", "frozen", "chill"),
      e("🥴", "woozy", "drunk", "dizzy", "tipsy"),
      e("😵", "dizzy", "knocked out", "dead"),
      e("🤯", "mind blown", "exploding", "shock", "amazed"),
      e("🤠", "cowboy", "hat", "yeehaw"),
      e("🥳", "party", "celebrate", "birthday", "congrats"),
      e("🥸", "disguise", "glasses", "incognito", "mustache"),
      e("😎", "cool", "sunglasses", "confident", "chill"),
      e("🤓", "nerd", "glasses", "smart", "geek"),
      e("🧐", "monocle", "curious", "inspect", "fancy"),
      e("😕", "confused", "unsure", "puzzled"),
      e("🫤", "diagonal mouth", "meh", "unsure", "skeptical"),
      e("😟", "worried", "concerned", "anxious"),
      e("🙁", "frown", "sad", "unhappy"),
      e("☹️", "frown", "sad", "unhappy"),
      e("😮", "open mouth", "surprise", "wow", "shock"),
      e("😯", "hushed", "surprise", "quiet shock"),
      e("😲", "astonished", "shock", "wow"),
      e("😳", "flushed", "embarrassed", "shy", "shocked"),
      e("🥺", "pleading", "puppy eyes", "please", "cute sad"),
      e("🥹", "holding tears", "touched", "emotional", "grateful"),
      e("😦", "frown open", "concern", "uneasy"),
      e("😧", "anguished", "pain", "distress"),
      e("😨", "fearful", "scared", "afraid"),
      e("😰", "anxious", "sweat", "nervous", "worried"),
      e("😥", "sad relief", "disappointed", "whew"),
      e("😢", "cry", "tear", "sad"),
      e("😭", "sobbing", "cry hard", "sad", "bawling"),
      e("😱", "scream", "fear", "shocked", "horror"),
      e("😖", "confounded", "frustrated", "upset"),
      e("😣", "persevering", "struggle", "effort"),
      e("😞", "disappointed", "sad", "let down"),
      e("😓", "downcast", "sweat", "hard day"),
      e("😩", "weary", "tired", "exhausted", "stressed"),
      e("😫", "tired", "exhausted", "fed up"),
      e("🥱", "yawn", "bored", "sleepy", "tired"),
      e("😤", "triumph", "huff", "frustrated", "steam"),
      e("😡", "pouting", "angry", "mad", "rage"),
      e("😠", "angry", "mad", "annoyed"),
      e("🤬", "swearing", "cursing", "furious", "symbols"),
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: [
      e("👋", "wave", "hello", "hi", "bye", "greeting"),
      e("🤚", "raised back hand", "stop", "high five"),
      e("🖐️", "hand", "five", "stop"),
      e("✋", "raised hand", "stop", "high five"),
      e("🖖", "vulcan", "spock", "live long", "star trek"),
      e("🫱", "right hand", "handshake"),
      e("🫲", "left hand", "handshake"),
      e("🫳", "palm down", "drop", "hold"),
      e("🫴", "palm up", "offer", "give", "come"),
      e("👌", "ok", "okay", "perfect", "good"),
      e("🤌", "pinched fingers", "italian", "what", "chef"),
      e("🤏", "pinching", "small", "tiny", "little"),
      e("✌️", "peace", "victory", "two"),
      e("🤞", "crossed fingers", "luck", "hope", "wish"),
      e("🫰", "heart hand", "love", "money"),
      e("🤟", "love you", "ily", "rock"),
      e("🤘", "rock on", "horns", "metal"),
      e("🤙", "call me", "shaka", "hang loose"),
      e("👈", "point left", "left"),
      e("👉", "point right", "right"),
      e("👆", "point up", "up"),
      e("🖕", "middle finger", "rude", "flip off"),
      e("👇", "point down", "down"),
      e("☝️", "index up", "one", "point"),
      e("🫵", "point at you", "you"),
      e("👍", "thumbs up", "yes", "like", "approve", "good", "ok"),
      e("👎", "thumbs down", "no", "dislike", "bad"),
      e("✊", "fist", "power", "solidarity"),
      e("👊", "punch", "fist bump", "bro"),
      e("🤛", "left fist", "bump"),
      e("🤜", "right fist", "bump"),
      e("👏", "clap", "applause", "congrats", "bravo"),
      e("🙌", "raised hands", "celebration", "hooray", "praise"),
      e("🫶", "heart hands", "love", "care"),
      e("👐", "open hands", "jazz hands"),
      e("🤲", "palms up", "pray", "please", "receive"),
      e("🤝", "handshake", "deal", "agree", "partnership"),
      e("🙏", "pray", "please", "thanks", "namaste", "hope"),
      e("💪", "muscle", "strong", "flex", "power", "workout"),
      e("🦾", "mechanical arm", "robot", "strong"),
      e("🦿", "mechanical leg", "robot"),
      e("🦵", "leg", "kick"),
      e("🦶", "foot", "kick", "stomp"),
      e("👂", "ear", "listen", "hear"),
      e("🦻", "hearing aid", "ear", "deaf"),
      e("👃", "nose", "smell"),
      e("🧠", "brain", "smart", "think", "mind", "intelligence"),
      e("🫀", "heart organ", "anatomy", "health"),
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: [
      e("❤️", "red heart", "love", "like", "romance"),
      e("🧡", "orange heart", "love", "friendship"),
      e("💛", "yellow heart", "love", "friendship", "happy"),
      e("💚", "green heart", "love", "nature", "jealousy"),
      e("💙", "blue heart", "love", "trust", "calm"),
      e("💜", "purple heart", "love", "care"),
      e("🖤", "black heart", "love", "dark", "edgy"),
      e("🤍", "white heart", "love", "pure", "clean"),
      e("🤎", "brown heart", "love"),
      e("💔", "broken heart", "heartbreak", "sad", "hurt"),
      e("❤️‍🔥", "heart on fire", "passion", "love", "desire"),
      e("❤️‍🩹", "mending heart", "healing", "recover", "care"),
      e("💕", "two hearts", "love", "affection"),
      e("💞", "revolving hearts", "love", "spinning"),
      e("💓", "beating heart", "love", "alive"),
      e("💗", "growing heart", "love", "nervous"),
      e("💖", "sparkling heart", "love", "excited"),
      e("💘", "heart arrow", "cupid", "love", "crush"),
      e("💝", "heart gift", "love", "present", "valentine"),
      e("💟", "heart decoration", "love"),
      e("♥️", "heart suit", "love", "cards"),
      e("💋", "kiss mark", "lips", "kiss", "love"),
      e("💌", "love letter", "mail", "romance"),
      e("💐", "bouquet", "flowers", "gift", "thanks"),
      e("🌹", "rose", "flower", "romance", "love"),
      e("🥀", "wilted rose", "sad", "dead flower"),
      e("🌺", "hibiscus", "flower", "tropical"),
      e("🌸", "cherry blossom", "flower", "spring", "pretty"),
      e("🌼", "blossom", "flower", "happy"),
      e("🌻", "sunflower", "flower", "summer", "bright"),
      e("🪷", "lotus", "flower", "calm", "peace"),
      e("🏵️", "rosette", "award", "flower"),
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      e("⭐", "star", "favorite", "important"),
      e("🌟", "glowing star", "shine", "special"),
      e("✨", "sparkles", "magic", "new", "clean", "shine"),
      e("💫", "dizzy star", "sparkle", "wow"),
      e("🔥", "fire", "hot", "lit", "trending", "awesome"),
      e("💥", "boom", "collision", "impact", "explosion"),
      e("💯", "hundred", "perfect", "keep it 100", "score"),
      e("✅", "check", "done", "yes", "complete", "approved"),
      e("❌", "cross", "no", "wrong", "cancel", "error"),
      e("⚠️", "warning", "caution", "alert"),
      e("🎉", "party", "tada", "celebrate", "congrats", "success"),
      e("🎊", "confetti", "party", "celebrate"),
      e("🎈", "balloon", "party", "birthday"),
      e("🎁", "gift", "present", "birthday", "surprise"),
      e("🏆", "trophy", "win", "champion", "award"),
      e("🥇", "gold medal", "first", "win", "place"),
      e("📌", "pin", "pushpin", "important", "location"),
      e("📎", "paperclip", "attach", "file"),
      e("✏️", "pencil", "write", "edit"),
      e("📝", "memo", "note", "write", "document"),
      e("💼", "briefcase", "work", "business", "job"),
      e("📁", "folder", "files", "directory"),
      e("📊", "bar chart", "stats", "data", "analytics"),
      e("📈", "chart up", "growth", "trending", "success"),
      e("🔔", "bell", "notification", "alert", "ring"),
      e("🔕", "muted bell", "silent", "no notification"),
      e("💬", "speech bubble", "chat", "message", "talk"),
      e("💭", "thought bubble", "think", "idea", "dream"),
      e("🗯️", "anger bubble", "rant", "mad"),
      e("👀", "eyes", "looking", "watch", "see", "curious"),
      e("🧠", "brain", "smart", "think", "idea"),
      e("💡", "bulb", "idea", "light", "insight"),
      e("☕", "coffee", "tea", "cafe", "morning"),
      e("🍕", "pizza", "food", "hungry"),
      e("🍔", "burger", "food", "hungry"),
      e("🌮", "taco", "food", "mexican"),
      e("🍩", "donut", "doughnut", "sweet", "dessert"),
      e("🍪", "cookie", "sweet", "dessert"),
      e("🎂", "cake", "birthday", "celebration"),
      e("🍾", "champagne", "celebrate", "congrats", "toast"),
      e("🥂", "clink glasses", "toast", "cheers", "celebrate"),
      e("🍻", "beers", "cheers", "drink", "party"),
      e("⚽", "soccer", "football", "sport"),
      e("🏀", "basketball", "sport"),
      e("🎮", "game", "controller", "play", "gaming"),
      e("🎧", "headphones", "music", "audio"),
      e("📱", "phone", "mobile", "call", "text"),
      e("💻", "laptop", "computer", "work", "code"),
    ],
  },
  {
    id: "animals",
    label: "Animals",
    emojis: [
      e("🐶", "dog", "puppy", "pet", "cute"),
      e("🐱", "cat", "kitten", "pet", "cute"),
      e("🐭", "mouse", "rodent"),
      e("🐹", "hamster", "pet", "cute"),
      e("🐰", "rabbit", "bunny", "cute", "easter"),
      e("🦊", "fox", "clever", "sly"),
      e("🐻", "bear", "teddy"),
      e("🐼", "panda", "cute", "china"),
      e("🐨", "koala", "cute", "australia"),
      e("🐯", "tiger", "cat", "fierce"),
      e("🦁", "lion", "king", "brave", "strong"),
      e("🐮", "cow", "moo", "farm"),
      e("🐷", "pig", "oink", "farm"),
      e("🐸", "frog", "toad"),
      e("🐵", "monkey", "ape"),
      e("🙈", "see no evil", "monkey", "shy", "embarrassed"),
      e("🙉", "hear no evil", "monkey", "ignore"),
      e("🙊", "speak no evil", "monkey", "secret", "oops"),
      e("🐔", "chicken", "hen", "farm"),
      e("🐧", "penguin", "cold", "cute"),
      e("🐦", "bird", "tweet"),
      e("🐤", "chick", "baby bird", "cute"),
      e("🦄", "unicorn", "magic", "fantasy", "special"),
      e("🐝", "bee", "honey", "busy"),
      e("🦋", "butterfly", "pretty", "change"),
      e("🐌", "snail", "slow"),
      e("🐙", "octopus", "ocean", "tentacles"),
      e("🦑", "squid", "ocean"),
      e("🦀", "crab", "ocean", "sideways"),
      e("🐠", "tropical fish", "ocean", "colorful"),
      e("🐟", "fish", "ocean"),
      e("🐬", "dolphin", "ocean", "smart", "playful"),
    ],
  },
];

/** Flat searchable index (built once). */
export const ALL_SEARCHABLE_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export function searchEmojis(query: string, limit = 80): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ entry: EmojiEntry; score: number }> = [];

  for (const entry of ALL_SEARCHABLE_EMOJIS) {
    const haystack = entry.keywords.join(" ").toLowerCase();
    let score = 0;
    let allMatch = true;
    for (const token of tokens) {
      if (haystack.includes(token)) {
        // Prefer starts-with / exact keyword hits
        if (entry.keywords.some((k) => k.toLowerCase() === token)) score += 10;
        else if (entry.keywords.some((k) => k.toLowerCase().startsWith(token))) score += 5;
        else score += 1;
      } else {
        allMatch = false;
        break;
      }
    }
    if (allMatch && score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.entry.keywords[0].localeCompare(b.entry.keywords[0]));
  // Dedupe by emoji character (same emoji could theoretically appear twice)
  const seen = new Set<string>();
  const out: EmojiEntry[] = [];
  for (const { entry } of scored) {
    if (seen.has(entry.emoji)) continue;
    seen.add(entry.emoji);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

export function insertAtCursor(
  el: HTMLTextAreaElement,
  text: string,
  current: string,
  setValue: (v: string) => void,
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
