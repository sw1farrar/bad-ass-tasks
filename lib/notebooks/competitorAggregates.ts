import type { Notebook, NotebookCompetitor, NotebookCompetitorNote } from "@/types";

export function normalizeCompetitorName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export interface CompetitorNameSuggestion {
  name: string;
  notebookCount: number;
  totalSalesPotential: number;
}

export interface AggregatedCompetitorNotebookRow {
  notebookId: string;
  notebookName: string;
  salesPotential: number;
  ourSales: number;
  competitorId: string;
}

export interface AggregatedCompetitor {
  key: string;
  name: string;
  totalSalesPotential: number;
  shareOfMarket: number;
  notebooks: AggregatedCompetitorNotebookRow[];
  noteCount: number;
}

export interface WorkspaceCompetitorBreakdown {
  aggregatedCompetitors: AggregatedCompetitor[];
  totalOurSales: number;
  totalCompetitorSales: number;
  totalMarket: number;
  ourMarketShare: number;
  activeNotebookCount: number;
}

const COMPETITOR_COLORS = [
  "bg-amber-400/70",
  "bg-sky-400/70",
  "bg-emerald-400/70",
  "bg-rose-400/70",
  "bg-orange-400/70",
  "bg-cyan-400/70",
  "bg-violet-400/70",
  "bg-lime-400/70",
];

export function competitorColorClass(index: number): string {
  return COMPETITOR_COLORS[index % COMPETITOR_COLORS.length];
}

export function getCompetitorNameSuggestions(
  allCompetitors: NotebookCompetitor[],
  notebookId: string,
): CompetitorNameSuggestion[] {
  const inNotebook = new Set(
    allCompetitors
      .filter((c) => c.notebookId === notebookId)
      .map((c) => normalizeCompetitorName(c.name)),
  );

  const byKey = new Map<
    string,
    { name: string; notebooks: Set<string>; totalSalesPotential: number }
  >();

  for (const competitor of allCompetitors) {
    const key = normalizeCompetitorName(competitor.name);
    if (!key || inNotebook.has(key)) continue;

    const existing = byKey.get(key);
    if (existing) {
      existing.notebooks.add(competitor.notebookId);
      existing.totalSalesPotential += competitor.salesPotential || 0;
    } else {
      byKey.set(key, {
        name: competitor.name.trim(),
        notebooks: new Set([competitor.notebookId]),
        totalSalesPotential: competitor.salesPotential || 0,
      });
    }
  }

  return [...byKey.values()]
    .map((entry) => ({
      name: entry.name,
      notebookCount: entry.notebooks.size,
      totalSalesPotential: entry.totalSalesPotential,
    }))
    .sort(
      (a, b) =>
        b.notebookCount - a.notebookCount ||
        b.totalSalesPotential - a.totalSalesPotential ||
        a.name.localeCompare(b.name),
    );
}

export function buildWorkspaceCompetitorBreakdown(
  competitors: NotebookCompetitor[],
  notebooks: Notebook[],
  notes: NotebookCompetitorNote[] = [],
  focusName?: string,
): WorkspaceCompetitorBreakdown & { focusKey?: string } {
  const notebookById = new Map(notebooks.map((nb) => [nb.id, nb]));
  const noteCountByCompetitorId = new Map<string, number>();
  for (const note of notes) {
    noteCountByCompetitorId.set(
      note.competitorId,
      (noteCountByCompetitorId.get(note.competitorId) ?? 0) + 1,
    );
  }

  const byKey = new Map<
    string,
    {
      name: string;
      totalSalesPotential: number;
      notebooks: AggregatedCompetitorNotebookRow[];
      noteCount: number;
    }
  >();

  for (const competitor of competitors) {
    const key = normalizeCompetitorName(competitor.name);
    if (!key) continue;
    const notebook = notebookById.get(competitor.notebookId);
    const row: AggregatedCompetitorNotebookRow = {
      notebookId: competitor.notebookId,
      notebookName: notebook?.name?.trim() || "Notebook",
      salesPotential: competitor.salesPotential || 0,
      ourSales: notebook?.ourSales ?? 0,
      competitorId: competitor.id,
    };
    const noteCount = noteCountByCompetitorId.get(competitor.id) ?? 0;

    const existing = byKey.get(key);
    if (existing) {
      existing.totalSalesPotential += row.salesPotential;
      existing.noteCount += noteCount;
      existing.notebooks.push(row);
    } else {
      byKey.set(key, {
        name: competitor.name.trim(),
        totalSalesPotential: row.salesPotential,
        notebooks: [row],
        noteCount,
      });
    }
  }

  const totalOurSales = notebooks.reduce((sum, nb) => sum + (nb.ourSales ?? 0), 0);
  const totalCompetitorSales = [...byKey.values()].reduce(
    (sum, entry) => sum + entry.totalSalesPotential,
    0,
  );
  const totalMarket = totalOurSales + totalCompetitorSales;
  const ourMarketShare = totalMarket > 0 ? (totalOurSales / totalMarket) * 100 : 0;

  let aggregatedCompetitors: AggregatedCompetitor[] = [...byKey.entries()].map(
    ([key, entry]) => ({
      key,
      name: entry.name,
      totalSalesPotential: entry.totalSalesPotential,
      shareOfMarket:
        totalMarket > 0 ? (entry.totalSalesPotential / totalMarket) * 100 : 0,
      notebooks: entry.notebooks.sort((a, b) => b.salesPotential - a.salesPotential),
      noteCount: entry.noteCount,
    }),
  );

  if (focusName) {
    const focusKey = normalizeCompetitorName(focusName);
    aggregatedCompetitors = aggregatedCompetitors.sort((a, b) => {
      if (a.key === focusKey) return -1;
      if (b.key === focusKey) return 1;
      return b.totalSalesPotential - a.totalSalesPotential;
    });
    return {
      aggregatedCompetitors,
      totalOurSales,
      totalCompetitorSales,
      totalMarket,
      ourMarketShare,
      activeNotebookCount: notebooks.length,
      focusKey,
    };
  }

  aggregatedCompetitors.sort((a, b) => b.totalSalesPotential - a.totalSalesPotential);

  return {
    aggregatedCompetitors,
    totalOurSales,
    totalCompetitorSales,
    totalMarket,
    ourMarketShare,
    activeNotebookCount: notebooks.length,
  };
}

export function isCompetitorNameInNotebook(
  competitors: NotebookCompetitor[],
  notebookId: string,
  name: string,
): boolean {
  const key = normalizeCompetitorName(name);
  return competitors.some(
    (c) => c.notebookId === notebookId && normalizeCompetitorName(c.name) === key,
  );
}