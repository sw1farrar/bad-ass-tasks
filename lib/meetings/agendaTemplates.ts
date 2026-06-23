export interface MeetingTemplate {
  id: string;
  label: string;
  description: string;
  topics: Array<{ title: string; timeBudgetMinutes?: number }>;
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: "standup",
    label: "Standup",
    description: "Quick sync — blockers, progress, plan",
    topics: [
      { title: "Wins since last meeting", timeBudgetMinutes: 5 },
      { title: "Blockers", timeBudgetMinutes: 10 },
      { title: "Today's focus", timeBudgetMinutes: 10 },
    ],
  },
  {
    id: "one-on-one",
    label: "1:1",
    description: "Personal check-in and priorities",
    topics: [
      { title: "Check-in", timeBudgetMinutes: 10 },
      { title: "Priorities & feedback", timeBudgetMinutes: 20 },
      { title: "Action items", timeBudgetMinutes: 5 },
    ],
  },
  {
    id: "retro",
    label: "Retrospective",
    description: "Reflect, improve, commit",
    topics: [
      { title: "What went well", timeBudgetMinutes: 15 },
      { title: "What didn't go well", timeBudgetMinutes: 15 },
      { title: "What we'll try next", timeBudgetMinutes: 15 },
    ],
  },
  {
    id: "board",
    label: "Board meeting",
    description: "Formal review and decisions",
    topics: [
      { title: "Approval of minutes", timeBudgetMinutes: 5 },
      { title: "Financial update", timeBudgetMinutes: 15 },
      { title: "Strategic items", timeBudgetMinutes: 30 },
      { title: "Decisions & next steps", timeBudgetMinutes: 10 },
    ],
  },
];

export function getMeetingTemplate(id: string): MeetingTemplate | undefined {
  return MEETING_TEMPLATES.find((t) => t.id === id);
}