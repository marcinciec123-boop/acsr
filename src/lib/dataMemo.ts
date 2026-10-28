// Memoizacja ciężkich obliczeń powiązana z tożsamością danych zapisu.
// loadFromStorage zwraca ten sam obiekt, dopóki surowy zapis się nie zmienił,
// więc wynik jest przeliczany wyłącznie po faktycznej zmianie danych —
// nic nie jest pomijane ani nieaktualne.
import { loadFromStorage } from "./storage";

const deps = () => [
  loadFromStorage<unknown>("tournaments_data", null),
  loadFromStorage<unknown>("ranking_data", null),
];

export function memoOnSave<A extends string | number | undefined, R>(fn: (arg: A) => R, extraKeys: string[] = []): (arg?: A) => R {
  let lastDeps: unknown[] = [];
  const cache = new Map<A, R>();
  return (arg?: A) => {
    const d = [...deps(), ...extraKeys.map(key => loadFromStorage<unknown>(key, null))];
    if (d.length !== lastDeps.length || d.some((v, i) => v !== lastDeps[i])) {
      cache.clear();
      lastDeps = d;
    }
    if (cache.has(arg as A)) return cache.get(arg as A) as R;
    const r = fn(arg as A);
    cache.set(arg as A, r);
    return r;
  };
}
