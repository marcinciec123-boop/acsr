export interface NewsText { title?: string; content: string }
const normalize = (value: string) => value.toLocaleLowerCase("pl-PL").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
export function isRepeatedNews(candidate: NewsText, existing: NewsText[]): boolean {
  const text = normalize(candidate.content);
  if (!text) return true;
  const words = new Set(text.split(" "));
  return existing.some(post => {
    const other = normalize(post.content);
    if (text === other) return true;
    if (candidate.title && post.title && normalize(candidate.title) === normalize(post.title)) return true;
    const otherWords = new Set(other.split(" "));
    if (words.size < 12 || otherWords.size < 12) return false;
    const intersection = [...words].filter(word => otherWords.has(word)).length;
    return intersection / (words.size + otherWords.size - intersection) >= 0.82;
  });
}
export const newsHeadline = (post: NewsText): string => post.title?.trim() ||
  (post.content.trim().split(/\n|(?<=[.!?])\s/)[0] || "Wpis ze zdjęciem").slice(0, 160);