import { memo, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
}

interface Props {
  initial: ComposerDraft;
  editing: boolean;
  categories: string[];
  categoryLabel: (cat: string) => string;
  onSubmit: (draft: ComposerDraft) => void;
  onCancel: () => void;
}

/**
 * Izolowany edytor postów — trzyma cały stan lokalnie, więc pisanie
 * nie powoduje re-renderu listy aktualności (płynne na telefonie).
 */
const NewsComposer = memo(({ initial, editing, categories, categoryLabel, onSubmit, onCancel }: Props) => {
  const [d, setD] = useState<ComposerDraft>(initial);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ComposerDraft>(k: K, v: ComposerDraft[K]) => setD(prev => ({ ...prev, [k]: v }));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksymalny rozmiar: 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => set("image", reader.result as string);
    reader.readAsDataURL(file);
  };

  const canPost = !!(d.content.trim() || d.title.trim() || d.image);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
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
        <select
          value={d.category}
          onChange={e => set("category", e.target.value)}
          className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
        >
          <option value="">Bez kategorii</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{categoryLabel(cat)}</option>
          ))}
        </select>
        <input
          type="date"
          value={d.date}
          onChange={e => set("date", e.target.value)}
          className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
        />
        <input
          type="time"
          value={d.time}
          onChange={e => set("time", e.target.value)}
          className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
        />
        <input
          value={d.author}
          onChange={e => set("author", e.target.value)}
          placeholder="Autor / redakcja"
          className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
        />
        <input
          value={d.source}
          onChange={e => set("source", e.target.value)}
          placeholder="Źródło (opcjonalnie)"
          className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
        />
        <input
          value={d.tags}
          onChange={e => set("tags", e.target.value)}
          placeholder="Tagi po przecinku (np. NAVI, Major, transfer)"
          className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground sm:col-span-2"
        />
      </div>
      <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={d.pinned} onChange={e => set("pinned", e.target.checked)} />
        Przypnij post na górze
      </label>
      {d.image && (
        <div className="relative inline-block">
          <img src={d.image} alt="Podgląd zdjęcia posta" loading="lazy" className="max-h-48 rounded-md" />
          <button
            onClick={() => set("image", null)}
            className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
          >
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
