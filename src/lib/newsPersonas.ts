const stems = ["eco", "clutch", "smoke", "pixel", "retake", "banana", "ramp", "flash", "demo", "strat", "pistol", "overtime", "cache", "mid", "boost", "anchor", "entry", "lurker", "scope", "trade", "tempo", "stack", "utility", "rotate"];
const endings = ["observer", "enjoyer", "veteran", "rookie", "watcher", "theory", "wizard", "hunter"];
const voices = ["analityk: liczby i spokojne argumenty", "memiarz: krótki suchy humor", "weteran: sceptyczny, bez idealnej interpunkcji", "świeżak: rzeczowe pytania", "kibic: emocjonalny, ale bez wymyślania faktów", "scout: zainteresowany młodymi zawodnikami", "kontrarianin: kwestionuje tezy z uzasadnieniem", "obserwator: spokojny i oszczędny w słowach"];
export const commenterPool = stems.flatMap((stem, i) => endings.map((ending, j) => ({ nick: `${stem}_${ending}`, voice: voices[(i + j) % voices.length] })));
export function selectCommenters(used: string[], size = 32) {
  const recent = new Set(used.map(nick => nick.toLowerCase()));
  const fresh = commenterPool.filter(persona => !recent.has(persona.nick.toLowerCase()));
  const pool = fresh.length >= size ? fresh : commenterPool;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(0, Math.min(size, pool.length)));
}