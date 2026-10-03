import { memo, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, X, Wand2, BarChart3, Paperclip, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NewsCover, NewsEmbed, TemplateResult } from "@/lib/newsExtras";
import {
  activeClubTeams,
  benchTemplate,
  listPlayedMatches,
  matchReportTemplate,
  rankingTemplate,
  transferTemplate,
} from "@/lib/newsExtras";
import { CoverBanner } from "@/components/news/NewsExtras";

export interface ComposerDraft {
  title: string;
  content: string;
  category: string;
  date: string;
  time: string;
  author: string;
  source: string;
  tags: string;
  pinned: boolean;
  image: string | null;
  poll: { question: string; options: string } | null;
  embeds: NewsEmbed[];
  cover: NewsCover | null;
}

interface Props {
  initial: ComposerDraft;
  editing: boolean;
  categories: string[];
  categoryLabel: (cat: string) => string;
  onSubmit: (draft: ComposerDraft) => void;
  onCancel: () => void;
}

type TplKind = "" | "match" | "transfer" | "bench" | "ranking";

const fieldCls = "h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground";

/**
 * Izolowany edytor postów — trzyma cały stan lokalnie, więc pisanie
 * nie powoduje re-renderu listy aktualności (płynne na telefonie).
 */
const NewsComposer = memo(({ initial, editing, categories, categoryLabel, onSubmit, onCancel }: Props) => {
  const [d, setD] = useState<ComposerDraft>(initial);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ComposerDraft>(k: K, v: ComposerDraft[K]) => setD(prev => ({ ...prev, [k]: v }));

  // --- szablony ---
  const [tpl, setTpl] = useState<TplKind>("");
  const [tMatch, setTMatch] = useState("");
  const [tPlayer, setTPlayer] = useState("");
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [tTeam, setTTeam] = useState("");
  const [embedPlayer, setEmbedPlayer] = useState("");
  const [embedMatch, setEmbedMatch] = useState("");

  const teams = useMemo(() => activeClubTeams(), []);
  const matches = useMemo(() => (tpl === "match" || d.embeds !== undefined ? listPlayedMatches(80) : []), [tpl, d.embeds]);
  const players = useMemo(
    () => [...new Set(teams.flatMap(t => t.roster.filter(Boolean)))].sort((a, b) => a.localeCompare(b)),
    [teams],
  );
  const teamOfPlayer = (p: string) => teams.find(t => t.roster.some(r => r?.toLowerCase() === p.toLowerCase()))?.name || "";

  const applyTemplate = (r: TemplateResult) => {
    setD(prev => ({
      ...prev,
      title: r.title,
      content: r.content,
      category: categories.includes(r.category) ? r.category : prev.category,
      tags: r.tags.join(", "),
      embeds: r.embeds || [],
      cover: r.cover || null,
      poll: r.poll ? { question: r.poll.question, options: r.poll.options.join("\n") } : prev.poll,
    }));
    setTpl("");
  };

  const runTemplate = () => {
    if (tpl === "match") {
      const ref = matches.find(m => `${m.tournamentId}|${m.match.id}` === tMatch);
      if (ref) applyTemplate(matchReportTemplate(ref));
    } else if (tpl === "transfer" && tPlayer && tTo) {
      applyTemplate(transferTemplate(tPlayer, tFrom || teamOfPlayer(tPlayer) || "-", tTo));
    } else if (tpl === "bench" && tPlayer) {
      applyTemplate(benchTemplate(tPlayer, tTeam || teamOfPlayer(tPlayer) || "drużyna"));
    } else if (tpl === "ranking" && tTeam) {
      const idx = teams.findIndex(t => t.name === tTeam);
      if (idx >= 0) applyTemplate(rankingTemplate(tTeam, idx + 1, teams[idx].points || 0));
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksymalny rozmiar: 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => set("image", reader.result as string);
    reader.readAsDataURL(file);
  };

  const addEmbed = (e: NewsEmbed) => {
    const key = (x: NewsEmbed) => x.kind === "match" ? `m:${x.matchId}` : `p:${x.name}`;
    if (d.embeds.some(x => key(x) === key(e))) return;
    set("embeds", [...d.embeds, e]);
  };

  const canPost = !!(d.content.trim() || d.title.trim() || d.image);
  const matchLabel = (m: (typeof matches)[number]) =>
    `${m.match.team1} ${m.match.score1}:${m.match.score2} ${m.match.team2} — ${m.tournamentName}${m.match.round ? ` (${m.match.round})` : ""}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      {/* Szablony */}
      <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Wand2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">Szablony</span>
          {([
            ["match", "Raport z meczu"],
            ["transfer", "Transfer"],
            ["bench", "Ławka"],
            ["ranking", "Ranking"],
          ] as [TplKind, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTpl(tpl === k ? "" : k)}
              className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${tpl === k ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-primary"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {tpl && (
          <div className="flex flex-wrap gap-2 items-center">
            {tpl === "match" && (
              <select value={tMatch} onChange={e => setTMatch(e.target.value)} className={`${fieldCls} flex-1 min-w-[240px]`}>
                <option value="">Wybierz rozegrany mecz…</option>
                {matches.map(m => (
                  <option key={`${m.tournamentId}|${m.match.id}`} value={`${m.tournamentId}|${m.match.id}`}>{matchLabel(m)}</option>
                ))}
              </select>
            )}
            {(tpl === "transfer" || tpl === "bench") && (
              <>
                <input list="composer-players" value={tPlayer} onChange={e => setTPlayer(e.target.value)} placeholder="Gracz" className={fieldCls} />
                <datalist id="composer-players">{players.map(p => <option key={p} value={p} />)}</datalist>
              </>
            )}
            {tpl === "transfer" && (
              <>
                <select value={tFrom} onChange={e => setTFrom(e.target.value)} className={fieldCls}>
                  <option value="">Z: (obecna drużyna / wolny agent)</option>
                  <option value="-">Wolny agent</option>
                  {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <select value={tTo} onChange={e => setTTo(e.target.value)} className={fieldCls}>
                  <option value="">Do drużyny…</option>
                  {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </>
            )}
            {(tpl === "bench" || tpl === "ranking") && (
              <select value={tTeam} onChange={e => setTTeam(e.target.value)} className={fieldCls}>
                <option value="">{tpl === "bench" ? "Drużyna (auto)" : "Wybierz drużynę…"}</option>
                {teams.map((t, i) => <option key={t.name} value={t.name}>{tpl === "ranking" ? `#${i + 1} ` : ""}{t.name}</option>)}
              </select>
            )}
            <Button size="sm" className="h-8 text-xs" onClick={runTemplate}>Wypełnij</Button>
          </div>
        )}
      </div>

      <input
        value={d.title}
        onChange={e => set("title", e.target.value)}
        placeholder="Nagłówek (opcjonalnie)"
        className="w-full h-10 px-3 rounded-md border border-border bg-secondary/50 text-sm font-heading font-bold text-foreground"
      />
      <Textarea
        placeholder="Treść artykułu..."
        value={d.content}
        onChange={e => set("content", e.target.value)}
        className="bg-secondary/50 border-border min-h-[140px] resize-y"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={d.category} onChange={e => set("category", e.target.value)} className={fieldCls}>
          <option value="">Bez kategorii</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{categoryLabel(cat)}</option>
          ))}
        </select>
        <input type="date" value={d.date} onChange={e => set("date", e.target.value)} className={fieldCls} />
        <input type="time" value={d.time} onChange={e => set("time", e.target.value)} className={fieldCls} />
        <input value={d.author} onChange={e => set("author", e.target.value)} placeholder="Autor / redakcja" className={fieldCls} />
        <input value={d.source} onChange={e => set("source", e.target.value)} placeholder="Źródło (opcjonalnie)" className={fieldCls} />
        <input
          value={d.tags}
          onChange={e => set("tags", e.target.value)}
          placeholder="Tagi po przecinku (np. NAVI, Major, transfer)"
          className={`${fieldCls} sm:col-span-2`}
        />
      </div>

      {/* Sonda */}
      <div className="rounded-md border border-border p-2.5 space-y-2">
        <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!d.poll}
            onChange={e => set("poll", e.target.checked ? { question: "", options: "" } : null)}
          />
          <BarChart3 className="w-3.5 h-3.5" /> Dodaj sondę społeczności
        </label>
        {d.poll && (
          <div className="space-y-2">
            <input
              value={d.poll.question}
              onChange={e => set("poll", { ...d.poll!, question: e.target.value })}
              placeholder="Pytanie (np. Kto wygra finał?)"
              className={`${fieldCls} w-full`}
            />
            <Textarea
              value={d.poll.options}
              onChange={e => set("poll", { ...d.poll!, options: e.target.value })}
              placeholder={"Opcje — każda w nowej linii (2–6)\nnazwy drużyn dostaną głosy wg siły w rankingu"}
              rows={3}
              className="text-xs bg-secondary/50"
            />
          </div>
        )}
      </div>

      {/* Załączniki */}
      <div className="rounded-md border border-border p-2.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Paperclip className="w-3.5 h-3.5" /> Karty w poście (mecz / gracz)
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={embedMatch} onChange={e => setEmbedMatch(e.target.value)} className={`${fieldCls} flex-1 min-w-[200px]`}>
            <option value="">Mecz…</option>
            {matches.map(m => (
              <option key={`${m.tournamentId}|${m.match.id}`} value={`${m.tournamentId}|${m.match.id}`}>{matchLabel(m)}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="h-9 text-xs" disabled={!embedMatch} onClick={() => {
            const [tournamentId, matchId] = embedMatch.split("|");
            addEmbed({ kind: "match", tournamentId, matchId });
            setEmbedMatch("");
          }}>+ Mecz</Button>
          <input list="composer-players" value={embedPlayer} onChange={e => setEmbedPlayer(e.target.value)} placeholder="Gracz…" className={fieldCls} />
          <datalist id="composer-players">{players.map(p => <option key={p} value={p} />)}</datalist>
          <Button size="sm" variant="outline" className="h-9 text-xs" disabled={!embedPlayer.trim()} onClick={() => {
            addEmbed({ kind: "player", name: embedPlayer.trim() });
            setEmbedPlayer("");
          }}>+ Gracz</Button>
        </div>
        {d.embeds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.embeds.map((e, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-secondary/40 text-xs font-mono text-foreground">
                {e.kind === "player" ? `👤 ${e.name}` : `⚔ ${matches.find(m => m.match.id === e.matchId)?.match.team1 ?? "mecz"} vs ${matches.find(m => m.match.id === e.matchId)?.match.team2 ?? ""}`}
                <button type="button" onClick={() => set("embeds", d.embeds.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Okładka */}
      <div className="rounded-md border border-border p-2.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Flag className="w-3.5 h-3.5" /> Baner okładki (gdy nie wgrywasz zdjęcia)
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={d.cover?.teamA || ""} onChange={e => set("cover", e.target.value ? { ...(d.cover || {}), teamA: e.target.value } : null)} className={fieldCls}>
            <option value="">Brak banera</option>
            {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
          {d.cover && (
            <>
              <select value={d.cover.teamB || ""} onChange={e => set("cover", { ...d.cover!, teamB: e.target.value || undefined })} className={fieldCls}>
                <option value="">Bez rywala</option>
                {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
              <input value={d.cover.label || ""} onChange={e => set("cover", { ...d.cover!, label: e.target.value || undefined })} placeholder="Podpis (np. FINAŁ)" className={fieldCls} />
            </>
          )}
        </div>
        {d.cover && !d.image && <CoverBanner cover={d.cover} />}
      </div>

      <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={d.pinned} onChange={e => set("pinned", e.target.checked)} />
        Przypnij post na górze
      </label>
      {d.image && (
        <div className="relative inline-block">
          <img src={d.image} alt="Podgląd zdjęcia posta" loading="lazy" className="max-h-48 rounded-md" />
          <button onClick={() => set("image", null)} className="absolute top-1 right-1 bg-background/80 rounded-full p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="w-4 h-4 mr-1" /> Zdjęcie
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Anuluj</Button>
          <Button size="sm" onClick={() => onSubmit(d)} disabled={!canPost}>
            {editing ? "Zapisz zmiany" : "Opublikuj"}
          </Button>
        </div>
      </div>
    </div>
  );
});

NewsComposer.displayName = "NewsComposer";
export default NewsComposer;
