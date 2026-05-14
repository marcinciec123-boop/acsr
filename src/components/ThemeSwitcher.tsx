import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEMES, getStoredTheme, setTheme, type ThemeId } from "@/lib/theme";

const ThemeSwitcher = () => {
  const [active, setActive] = useState<ThemeId>(() => getStoredTheme());

  const handleSelect = (id: ThemeId) => {
    setTheme(id);
    setActive(id);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 className="font-heading font-bold text-foreground mb-1 flex items-center gap-2">
        <Palette className="w-4 h-4 text-primary" />
        Motyw aplikacji
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Wybierz styl wizualny — zmiana jest natychmiastowa i zapamiętywana.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEMES.map(theme => {
          const isActive = active === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelect(theme.id)}
              className={cn(
                "relative text-left rounded-lg border p-3 transition-all hover:border-primary/60",
                isActive ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-secondary/20",
              )}
            >
              {isActive && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="flex gap-1 mb-2 h-8 rounded overflow-hidden border border-border">
                {theme.swatches.map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <p className="font-heading font-bold text-foreground text-sm">{theme.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{theme.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
