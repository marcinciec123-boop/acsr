import { useState } from "react";
import { Type, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONTS, getStoredFont, setFont, type FontId } from "@/lib/font";

const FontSwitcher = () => {
  const [active, setActive] = useState<FontId>(() => getStoredFont());

  const handleSelect = (id: FontId) => {
    setFont(id);
    setActive(id);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 className="font-heading font-bold text-foreground mb-1 flex items-center gap-2">
        <Type className="w-4 h-4 text-primary" />
        Czcionka aplikacji
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Wybierz zestaw czcionek — zmiana jest natychmiastowa i zapamiętywana.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FONTS.map(font => {
          const isActive = active === font.id;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelect(font.id)}
              className={cn(
                "relative text-left rounded-lg border p-4 transition-all hover:border-primary/60",
                isActive ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-secondary/20",
              )}
            >
              {isActive && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <p
                className="font-bold text-foreground text-lg mb-1"
                style={{ fontFamily: font.heading }}
              >
                {font.name}
              </p>
              <p className="text-sm text-muted-foreground mb-2">{font.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                <span style={{ fontFamily: font.heading }}>{font.heading}</span>
                <span className="text-border">/</span>
                <span style={{ fontFamily: font.body }}>{font.body}</span>
                <span className="text-border">/</span>
                <span style={{ fontFamily: font.mono }}>{font.mono}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FontSwitcher;
