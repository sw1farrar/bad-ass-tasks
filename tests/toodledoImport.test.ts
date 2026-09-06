import { describe, expect, it } from "vitest";
import { parseToodledoRepeat } from "@/features/import/platforms/toodledo/toodledoRepeat";
import { mapToodledoTask } from "@/features/import/platforms/toodledo/mapToodledoTask";
import { parseToodledoCsv } from "@/features/import/platforms/toodledo/parseToodledoCsv";
import { getNextRecurringDueAfterComplete, parseRecurringRule, toLocalDateString } from "@/lib/utils";

const REPEAT_CASES: Array<{ repeat: string; freq: string; interval?: number; byDay?: string[]; byMonthNth?: number }> = [
  { repeat: "Yearly", freq: "YEARLY" },
  { repeat: "Semiannually", freq: "MONTHLY", interval: 6 },
  { repeat: "Quarterly", freq: "MONTHLY", interval: 3 },
  { repeat: "Monthly", freq: "MONTHLY" },
  { repeat: "Every 4 months", freq: "MONTHLY", interval: 4 },
  { repeat: "Every 6 weeks", freq: "WEEKLY", interval: 6 },
  { repeat: "Every 3 weeks", freq: "WEEKLY", interval: 3 },
  { repeat: "Bimonthly", freq: "MONTHLY", interval: 2 },
  { repeat: "Weekly", freq: "WEEKLY" },
  { repeat: "Biweekly", freq: "WEEKLY", interval: 2 },
  { repeat: "Every 4 weeks", freq: "WEEKLY", interval: 4 },
  { repeat: "Every 5 weeks", freq: "WEEKLY", interval: 5 },
  { repeat: "Every 7 weeks", freq: "WEEKLY", interval: 7 },
  { repeat: "Every 8 weeks", freq: "WEEKLY", interval: 8 },
  { repeat: "Every 10 weeks", freq: "WEEKLY", interval: 10 },
  { repeat: "Every 16 weeks", freq: "WEEKLY", interval: 16 },
  { repeat: "Every 30 days", freq: "DAILY", interval: 30 },
  { repeat: "Every 25 days", freq: "DAILY", interval: 25 },
  { repeat: "Every 2 years", freq: "YEARLY", interval: 2 },
  { repeat: "Every Mon", freq: "WEEKLY", byDay: ["MO"] },
  { repeat: "Every Tue", freq: "WEEKLY", byDay: ["TU"] },
  { repeat: "Every Wed", freq: "WEEKLY", byDay: ["WE"] },
  { repeat: "Every Thu", freq: "WEEKLY", byDay: ["TH"] },
  { repeat: "Every Fri", freq: "WEEKLY", byDay: ["FR"] },
  { repeat: "Every Sat", freq: "WEEKLY", byDay: ["SA"] },
  { repeat: "Every Sun", freq: "WEEKLY", byDay: ["SU"] },
  { repeat: "Every Thu, Sun", freq: "WEEKLY", byDay: ["TH", "SU"] },
  { repeat: "Every Wed, Sun", freq: "WEEKLY", byDay: ["WE", "SU"] },
  { repeat: "Every Wed, Sat", freq: "WEEKLY", byDay: ["WE", "SA"] },
  { repeat: "The 2nd Sun of each month", freq: "MONTHLY", byDay: ["SU"], byMonthNth: 2 },
  { repeat: "The last Tue of each month", freq: "MONTHLY", byDay: ["TU"], byMonthNth: -1 },
  { repeat: "The last Thu of each month", freq: "MONTHLY", byDay: ["TH"], byMonthNth: -1 },
  { repeat: "The 1st Mon of each month", freq: "MONTHLY", byDay: ["MO"], byMonthNth: 1 },
  { repeat: "The 1st Sat of each month", freq: "MONTHLY", byDay: ["SA"], byMonthNth: 1 },
  { repeat: "The 3rd Mon of each month", freq: "MONTHLY", byDay: ["MO"], byMonthNth: 3 },
  { repeat: "The 1st Wed of each month", freq: "MONTHLY", byDay: ["WE"], byMonthNth: 1 },
  { repeat: "The last Sun of each month", freq: "MONTHLY", byDay: ["SU"], byMonthNth: -1 },
  { repeat: "The 2nd Wed of each month", freq: "MONTHLY", byDay: ["WE"], byMonthNth: 2 },
  { repeat: "The last Wed of each month", freq: "MONTHLY", byDay: ["WE"], byMonthNth: -1 },
];

describe("Toodledo REPEAT mapping", () => {
  it.each(REPEAT_CASES)("maps $repeat", ({ repeat, freq, interval, byDay, byMonthNth }) => {
    const result = parseToodledoRepeat(repeat);
    expect(result.unmapped).toBe(false);
    expect(result.pattern?.freq).toBe(freq);
    expect(result.pattern?.interval).toBe(interval ?? 1);
    if (byDay) expect(result.pattern?.byDay).toEqual(byDay);
    if (byMonthNth) expect(result.pattern?.byMonthNth).toBe(byMonthNth);
    expect(result.rule).toBeTruthy();
    expect(parseRecurringRule(result.rule)).toBeTruthy();
  });

  it("treats empty repeat as no rule", () => {
    const result = parseToodledoRepeat("");
    expect(result.unmapped).toBe(false);
    expect(result.rule).toBeNull();
  });

  it("flags unknown repeats", () => {
    const result = parseToodledoRepeat("With Parent");
    expect(result.unmapped).toBe(true);
    expect(result.rule).toBeNull();
  });

  it("parses from completion suffix", () => {
    const result = parseToodledoRepeat("Every 6 weeks from completion");
    expect(result.fromCompletion).toBe(true);
    expect(result.pattern?.fromCompletion).toBe(true);
    expect(result.rule).toContain("FROMCOMPLETION=TRUE");
  });
});

describe("mapToodledoTask", () => {
  it("maps a current recurring row with notes and folder", () => {
    const task = mapToodledoTask(
      {
        TASK: "Water Backyard Plants",
        FOLDER: "Home",
        DUEDATE: "2026-09-05",
        REPEAT: "Every Wed, Sat",
        PRIORITY: "1",
        NOTE: "Front and back",
      },
      "current",
    );
    expect(task?.title).toBe("Water Backyard Plants");
    expect(task?.folderName).toBe("Home");
    expect(task?.status).toBe("todo");
    expect(task?.priority).toBe("P2");
    expect(task?.description).toBe("Front and back");
    expect(task?.recurringRule).toContain("FREQ=WEEKLY");
    expect(task?.recurringRule).toContain("BYDAY=WE,SA");
    expect(task?.recurringRule).toContain("X-SERIES-ANCHOR=2026-09-05");
  });

  it("maps completed rows without recurrence even if REPEAT is set", () => {
    const task = mapToodledoTask(
      {
        TASK: "Water Backyard Plants",
        FOLDER: "Home",
        DUEDATE: "2026-09-02",
        REPEAT: "Weekly",
        PRIORITY: "1",
        COMPLETED: "2026-09-02",
        NOTE: "Did the pots",
      },
      "completed",
    );
    expect(task?.status).toBe("done");
    expect(task?.recurringRule).toBeNull();
    expect(task?.completedAt).toBeTruthy();
    expect(task?.description).toBe("Did the pots");
  });

  it("maps Top priority 3 to P0", () => {
    const task = mapToodledoTask(
      { TASK: "Urgent", PRIORITY: "3", DUEDATE: "2026-09-01" },
      "current",
    );
    expect(task?.priority).toBe("P0");
  });

  it("maps Toodledo negative and low priority to P3", () => {
    expect(mapToodledoTask({ TASK: "Low", PRIORITY: "0", DUEDATE: "2026-09-01" }, "current")?.priority).toBe("P3");
    expect(mapToodledoTask({ TASK: "Neg", PRIORITY: "-1", DUEDATE: "2026-09-01" }, "current")?.priority).toBe("P3");
    expect(mapToodledoTask({ TASK: "High", PRIORITY: "2", DUEDATE: "2026-09-01" }, "current")?.priority).toBe("P1");
  });

  it("maps star, tags, and length", () => {
    const task = mapToodledoTask(
      {
        TASK: "Starred",
        DUEDATE: "2026-09-01",
        STAR: "1",
        TAG: "home, errands",
        LENGTH: "30",
      },
      "current",
    );
    expect(task?.starred).toBe(true);
    expect(task?.tags).toEqual(["home", "errands"]);
    expect(task?.timeEstimate).toBe(30);
  });

  it("falls back to STARTDATE when DUEDATE is empty", () => {
    const task = mapToodledoTask(
      {
        TASK: "Jack Lender Info",
        FOLDER: "General",
        STARTDATE: "2017-07-29",
        COMPLETED: "2017-07-29",
        PRIORITY: "3",
      },
      "completed",
    );
    expect(task?.dueDate).toBeTruthy();
    expect(task?.status).toBe("done");
  });

  it("does not treat a current export as completed when hinted completed", () => {
    const preview = parseToodledoCsv(
      `"TASK","FOLDER","DUEDATE","REPEAT","PRIORITY","NOTE"\n"Water plants","Home","2026-09-05","Weekly","1",""\n`,
      "completed",
    );
    expect(preview.kind).toBe("current");
    expect(preview.tasks[0].status).toBe("todo");
    expect(preview.tasks[0].recurringRule).toBeTruthy();
  });

  it("preserves multiline notes", () => {
    const task = mapToodledoTask(
      {
        TASK: "Charge Battery Cameras",
        FOLDER: "Home",
        DUEDATE: "2026-09-08",
        REPEAT: "Every 6 weeks",
        NOTE: "Charged:\n\n2026.07.28 - 4 Indoor Only",
      },
      "current",
    );
    expect(task?.description).toContain("2026.07.28");
    expect(task?.description.split("\n").length).toBeGreaterThan(1);
  });
});

describe("parseToodledoCsv", () => {
  it("treats a completed export as completed even if the caller hinted current", () => {
    const preview = parseToodledoCsv(
      `"TASK","FOLDER","DUEDATE","PRIORITY","NOTE","COMPLETED"\n"State Fair","Personal","2026-09-05","1","","2026-09-04"\n"Mail","Home","2026-09-04","1","","2026-09-04"\n`,
      "current",
    );
    expect(preview.kind).toBe("completed");
    expect(preview.tasks.every((t) => t.status === "done" && t.recurringRule === null)).toBe(true);
  });

  it("disambiguates fingerprints for same title/due/completed", () => {
    const preview = parseToodledoCsv(
      `"TASK","FOLDER","DUEDATE","PRIORITY","NOTE","COMPLETED"\n"Mail","Home","2026-09-04","1","","2026-09-04"\n"Mail","Home","2026-09-04","1","","2026-09-04"\n`,
      "completed",
    );
    expect(preview.tasks).toHaveLength(2);
    expect(preview.tasks[0].fingerprint).not.toBe(preview.tasks[1].fingerprint);
  });

  it("parses quoted multiline notes and auto-detects current vs completed", () => {
    const current = parseToodledoCsv(
      `"TASK","FOLDER","DUEDATE","REPEAT","PRIORITY","NOTE"\n"Shop mixers","Errands","2027-02-01","Yearly","1","Club Soda\nGinger Ale"\n`,
    );
    expect(current.kind).toBe("current");
    expect(current.rowCount).toBe(1);
    expect(current.tasks[0].description).toContain("Ginger Ale");
    expect(current.recurringCount).toBe(1);

    const completed = parseToodledoCsv(
      `"TASK","FOLDER","DUEDATE","PRIORITY","NOTE","COMPLETED"\n"State Fair","Personal","2026-09-05","1","","2026-09-04"\n`,
    );
    expect(completed.kind).toBe("completed");
    expect(completed.tasks[0].status).toBe("done");
    expect(completed.tasks[0].recurringRule).toBeNull();
  });
});

describe("Rachel nth-weekday due dates", () => {
  it("2nd Sunday after 2026-09-13 is 2026-10-11", () => {
    const mapped = mapToodledoTask(
      {
        TASK: "Send Google Voice Text 5380",
        DUEDATE: "2026-09-13",
        REPEAT: "The 2nd Sun of each month",
      },
      "current",
    );
    const next = getNextRecurringDueAfterComplete(
      mapped!.recurringRule!,
      mapped!.dueDate,
      "2026-09-13",
    );
    expect(next ? toLocalDateString(next) : "").toBe("2026-10-11");
  });
});
