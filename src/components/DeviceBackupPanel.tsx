import { useEffect, useRef, useState } from "react";
import { Download, HardDrive, RotateCcw, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  createDeviceBackup,
  importDeviceBackup,
  listDeviceBackups,
  restoreDeviceBackup,
  type DeviceBackupSnapshot,
} from "@/lib/deviceBackup";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const DeviceBackupPanel = () => {
  const [backups, setBackups] = useState<DeviceBackupSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setBackups(await listDeviceBackups());

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("csgo-hub-device-backup", listener);
    return () => window.removeEventListener("csgo-hub-device-backup", listener);
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

  const handleExport = (backup: DeviceBackupSnapshot) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csgo-hub-zapis-${new Date(backup.createdAt).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    const raw = await file.text();
    const imported = await importDeviceBackup(raw);
    await refresh();
    toast({ title: "Zaimportowano zapis", description: imported.label });
  };

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

        <div className="border border-border bg-card rounded-lg p-4 mb-5">
          <p className="text-sm text-muted-foreground">
            Aplikacja robi automatyczny snapshot po zmianach w świecie. Zapis trzymany jest w pamięci tego urządzenia, a wybrany snapshot możesz też pobrać jako plik JSON.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={e => void handleImport(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" /> Importuj plik zapisu
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {backups.map(backup => (
            <div key={backup.id} className="border border-border bg-card rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-heading font-bold text-foreground">{backup.label}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  {new Date(backup.createdAt).toLocaleString("pl-PL")} · {backup.reason === "manual" ? "ręczny" : backup.reason === "import" ? "import" : "auto"} · {formatBytes(backup.size)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport(backup)} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Pobierz
                </Button>
                <Button size="sm" onClick={() => void handleRestore(backup)} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Przywróć
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