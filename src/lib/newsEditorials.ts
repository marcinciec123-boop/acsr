import { loadFromStorage, saveToStorage } from "./storage";
import type { NewsPost } from "./types";

const KEY = "news_editorials";
export function editorialNames(saved: string[], authors: string[]): string[] {
  const seen = new Set<string>();
  return [...saved, ...authors].map(name => name.trim()).filter(name => {
    const key = name.toLocaleLowerCase("pl-PL");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.localeCompare(b, "pl"));
}
export function loadEditorials(): string[] {
  return editorialNames(loadFromStorage<string[]>(KEY, []),
    loadFromStorage<NewsPost[]>("news_posts", []).map(post => post.author || ""));
}
export function addEditorial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Podaj nazwę redakcji.");
  const names = loadEditorials();
  const existing = names.find(value => value.toLocaleLowerCase("pl-PL") === trimmed.toLocaleLowerCase("pl-PL"));
  const selected = existing || trimmed;
  saveToStorage(KEY, editorialNames(names, [selected]));
  return selected;
}