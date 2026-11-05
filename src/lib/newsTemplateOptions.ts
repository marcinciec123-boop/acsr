import type { TeamData, TournamentData } from "./types";
import type { TemplateResult } from "./newsExtras";
import { computeCareerStats } from "./playerCareerStats";
import { playerRoles } from "@/data/playerRoles";

export type WritingStyle = "news" | "analysis" | "column" | "light" | "fanpage";
export type WritingLength = "short" | "medium" | "long";
export const writingInstructions = (style: WritingStyle, length: WritingLength) =>
  `Styl: ${({ news: "rzeczowa notka reporterska", analysis: "analiza oparta na faktach", column: "felieton z wyraźnie oddzieloną opinią", light: "lekki język i subtelny humor", fanpage: "FANPAGE — post właściciela fanpage'a: pierwsza osoba, emocje, slang, wulgaryzmy dozwolone" })[style]}. Długość: ${({ short: "2–3 zdania", medium: "4–6 zdań", long: "8–10 zdań w 2–3 akapitach" })[length]}.`;

export function tournamentTemplate(t: TournamentData, recap: boolean): TemplateResult {
  const placements = [...(t.placements || [])].sort((a, b) => a.placement - b.placement);
  const champion = placements.find(p => p.placement === 1)?.team;
  return {
    title: recap ? `${t.name}: bilans zakończonego turnieju` : `${t.name}: kto stanie do rywalizacji?`,
    content: recap
      ? `${t.name} zakończył się${champion ? ` zwycięstwem ${champion}` : "; w zapisie nie ma jeszcze zwycięzcy"}. ${placements.length ? `Końcowe miejsca: ${placements.slice(0, 8).map(p => `${p.placement}. ${p.team}`).join(", ")}.` : "Końcowa klasyfikacja nie została uzupełniona."}`
      : `${t.name} (Tier ${t.tier}) zaplanowano na ${t.startDate} – ${t.endDate}. Uczestnicy: ${(t.participants || []).join(", ") || "lista nie została jeszcze ustalona"}.`,
    category: recap ? "recap" : "preview", tags: [t.name, ...(champion ? [champion] : [])],
  };
}
export function playerTemplate(player: string, team: TeamData): TemplateResult {
  const stats = computeCareerStats(player);
  return { title: `${player}: sylwetka zawodnika ${team.name}`,
    content: `${player} reprezentuje ${team.name}${playerRoles[player] ? ` w roli ${playerRoles[player]}` : ""}. ${stats.matchesPlayed ? `W zapisanej karierze rozegrał ${stats.matchesPlayed} meczów z ratingiem ${stats.careerRating.toFixed(2)}.` : "W zapisie brakuje jeszcze rozegranych meczów tego gracza."}`,
    category: "mvp", tags: [player, team.name], embeds: [{ kind: "player", name: player }], cover: { teamA: team.name, label: player } };
}
export function teamTemplate(team: TeamData, rival?: TeamData): TemplateResult {
  return { title: rival ? `${team.name} kontra ${rival.name}: porównanie drużyn` : `${team.name}: przegląd składu`,
    content: [team, ...(rival ? [rival] : [])].map(t => `${t.name}: ${t.points || 0} pkt w bieżącym rankingu. Skład: ${t.roster.filter(Boolean).join(", ") || "brak ustalonego składu"}${t.coach ? `. Trener: ${t.coach}` : ""}.`).join("\n\n"),
    category: "analysis", tags: [team.name, ...(rival ? [rival.name] : [])], cover: { teamA: team.name, ...(rival ? { teamB: rival.name } : {}) } };
}

export function formatTemplate(result: TemplateResult, style: WritingStyle, length: WritingLength): TemplateResult {
  const sentences = result.content.split(/(?<=[.!?])\s+/).filter(Boolean);
  const content = length === "short" ? sentences.slice(0, 3).join(" ")
    : length === "long" ? sentences.join("\n\n") : result.content;
  const title = style === "analysis" ? `Analiza: ${result.title}` : style === "column" ? `Okiem redakcji: ${result.title}` : result.title;
  return { ...result, title, content, category: style === "column" ? "opinion" : style === "fanpage" ? "fanpage" : result.category };
}