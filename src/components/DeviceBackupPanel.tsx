import { useEffect, useRef, useState } from "react";
import { Download, HardDrive, RotateCcw, Save, Trash2, Upload, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  createDeviceBackup,
  deleteAllDeviceBackups,
  deleteDeviceBackup,
  deleteDeviceBackupsByReason,
  decodeDeviceBackupFile,
  encodeDeviceBackup,
  importDeviceBackup,
  isAutoBackupEnabled,
  listDeviceBackups,
  restoreDeviceBackup,
  setAutoBackupEnabled,
  type DeviceBackupSnapshot,
} from "@/lib/deviceBackup";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const reasonLabel = (r: DeviceBackupSnapshot["reason"]) =>
  r === "manual" ? "ręczny" : r === "import" ? "import" : "auto";

const DeviceBackupPanel = () => {
  const [backups, setBackups] = useState<DeviceBackupSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [autoOn, setAutoOn] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setBackups(await listDeviceBackups());

  useEffect(() => {
    void refresh();
    setAutoOn(isAutoBackupEnabled());
    const listener = () => void refresh();
    const toggleListener = () => setAutoOn(isAutoBackupEnabled());
    window.addEventListener("csgo-hub-device-backup", listener);
    window.addEventListener("csgo-hub-auto-backup-toggle", toggleListener);
    return () => {
      window.removeEventListener("csgo-hub-device-backup", listener);
      window.removeEventListener("csgo-hub-auto-backup-toggle", toggleListener);
    };
  }, []);

  const handleManualSave = async () => {
    setBusy(true);
    try {
      await createDeviceBackup("manual", "Ręczny zapis świata");
      await refresh();
      toast({ title: "Zapisano świat", description: "Snapshot jest zapisany na tym urządzeniu." });
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (backup: DeviceBackupSnapshot) => {
    if (!confirm(`Przywrócić zapis z ${new Date(backup.createdAt).toLocaleString("pl-PL")}? Strona przeładuje się po przywróceniu.`)) return;
    await restoreDeviceBackup(backup.id);
    window.location.reload();
  };

  const handleExport = async (backup: DeviceBackupSnapshot) => {
    setBusy(true);
    try {
      const { blob, extension } = await encodeDeviceBackup(backup, includeMedia);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `csgo-hub-zapis-${new Date(backup.createdAt).toISOString().slice(0, 10)}.${extension}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Pobrano zapis", description: `Rozmiar pliku: ${formatBytes(blob.size)}` });
    } catch (error) {
      toast({ title: "Nie udało się pobrać zapisu", description: error instanceof Error ? error.message : "Spróbuj ponownie.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const raw = await decodeDeviceBackupFile(file);
      const imported = await importDeviceBackup(raw);
      await refresh();
      toast({ title: "Zaimportowano zapis", description: imported.label });
    } catch (error) {
      toast({ title: "Nie udało się wczytać zapisu", description: error instanceof Error ? error.message : "Nieprawidłowy plik zapisu.", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setBusy(false);
    }
  };

  const handleDelete = async (backup: DeviceBackupSnapshot) => {
    if (!confirm(`Usunąć zapis z ${new Date(backup.createdAt).toLocaleString("pl-PL")}? Tej operacji nie można cofnąć.`)) return;
    await deleteDeviceBackup(backup.id);
    await refresh();
    toast({ title: "Zapis usunięty" });
  };

  const handleDeleteAllAuto = async () => {
    const autos = backups.filter(b => b.reason === "auto").length;
    if (autos === 0) {
      toast({ title: "Brak auto-zapisów" });
      return;
    }
    if (!confirm(`Usunąć ${autos} auto-zapisy? Ręczne i importowane zostaną zachowane.`)) return;
    const removed = await deleteDeviceBackupsByReason("auto");
    await refresh();
    toast({ title: `Usunięto ${removed} auto-zapisy` });
  };

  const handleDeleteAll = async () => {
    if (backups.length === 0) return;
    if (!confirm(`Usunąć WSZYSTKIE ${backups.length} zapisów (również ręczne)? Tej operacji nie można cofnąć.`)) return;
    const removed = await deleteAllDeviceBackups();
    await refresh();
    toast({ title: `Usunięto ${removed} zapisów` });
  };

  const handleToggleAuto = () => {
    const next = !autoOn;
    setAutoBackupEnabled(next);
    setAutoOn(next);
    toast({
      title: next ? "Autozapis włączony" : "Autozapis wyłączony",
      description: next
        ? "Aplikacja będzie zapisywać zmiany automatycznie."
        : "Pamiętaj o ręcznym zapisywaniu zmian.",
    });
  };

  const autoCount = backups.filter(b => b.reason === "auto").length;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Zapis urządzeniowy</h2>
          </div>
          <Button size="sm" onClick={handleManualSave} disabled={busy} className="gap-2">
            <Save className="w-4 h-4" /> Zapisz teraz
          </Button>
        </div>

        {/* Autozapis toggle */}
        <div className={cn(
          "border rounded-lg p-4 mb-4 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row",
          autoOn ? "border-border bg-card" : "border-destructive/40 bg-destructive/5",
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              autoOn ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
            )}>
              {autoOn ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-heading font-bold text-foreground">
                Autozapis: {autoOn ? "WŁĄCZONY" : "WYŁĄCZONY"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                {autoOn
                  ? "Snapshot powstaje automatycznie po każdej zmianie w świecie."
                  : "Auto-snapshoty są wyłączone. Zapisuj ręcznie przyciskiem „Zapisz teraz”."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={autoOn ? "outline" : "default"}
            onClick={handleToggleAuto}
            className="gap-2 shrink-0"
          >
            {autoOn ? <><PowerOff className="w-4 h-4" /> Wyłącz autozapis</> : <><Power className="w-4 h-4" /> Włącz autozapis</>}
          </Button>
        </div>

        <div className="border border-border bg-card rounded-lg p-4 mb-5">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="backup-include-media" className="text-sm text-foreground">Uwzględnij wgrane loga i zdjęcia w pliku</label>
            <Switch id="backup-include-media" checked={includeMedia} onCheckedChange={setIncludeMedia} disabled={busy} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,application/gzip,.json,.gz,.csgobackup"
              className="hidden"
              onChange={e => void handleImport(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy} className="gap-2">
              <Upload className="w-4 h-4" /> Importuj plik zapisu
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAllAuto}
              disabled={autoCount === 0}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" /> Usuń auto-zapisy ({autoCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAll}
              disabled={backups.length === 0}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" /> Usuń wszystkie
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {backups.map(backup => (
            <div key={backup.id} className="border border-border bg-card rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-heading font-bold text-foreground">{backup.label}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  {new Date(backup.createdAt).toLocaleString("pl-PL")} · {reasonLabel(backup.reason)} · {formatBytes(backup.size)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleExport(backup)} disabled={busy} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Pobierz
                </Button>
                <Button size="sm" onClick={() => void handleRestore(backup)} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Przywróć
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDelete(backup)}
                  className="gap-1.5 text-destructive hover:text-destructive"
                  aria-label="Usuń zapis"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {backups.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Nie ma jeszcze snapshotów. Kliknij „Zapisz teraz”.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DeviceBackupPanel;
