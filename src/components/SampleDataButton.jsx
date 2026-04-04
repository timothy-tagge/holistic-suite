import { useState } from "react";
import { FlaskConical, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * SampleDataButton — a shared "Load sample data" trigger used by every module tab.
 *
 * Props:
 *   profiles         — array of { id, label, description, [investmentCount|childCount] }
 *   onLoad(id)       — called with the selected profile id; should return a Promise
 *   destructive      — if true, shows a warning that existing data will be replaced
 *                      (default true for modules that do a full replace)
 *   activeSampleId   — id of the currently active sample (if any); highlights it in the list
 *   userOption       — { label, description } — if provided, shows a "My data" entry at the top
 *   onLoadUser()     — called when the user selects the userOption; should return a Promise
 */
export function SampleDataButton({
  profiles,
  onLoad,
  destructive = true,
  activeSampleId = null,
  userOption = null,
  onLoadUser = null,
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isUserSelected = selected === "__user__";

  async function handleLoad() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      if (isUserSelected) {
        await onLoadUser?.();
      } else {
        await onLoad(selected);
      }
      setOpen(false);
      setSelected(null);
    } catch (e) {
      setError(e.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setSelected(null);
    setError(null);
    setOpen(true);
  }

  const triggerLabel = activeSampleId
    ? (profiles.find((p) => p.id === activeSampleId)?.label ?? "Sample data")
    : "Sample data";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={handleOpen}
      >
        <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && !loading) {
            setOpen(false);
            setSelected(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load sample data</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {destructive && (
              <p className="text-sm text-muted-foreground rounded-md bg-muted/60 px-3 py-2">
                Selecting a sample will <strong>replace all existing data</strong> in this
                module. This cannot be undone.
              </p>
            )}

            {userOption && (
              <button
                onClick={() => setSelected("__user__")}
                className={[
                  "w-full text-left rounded-lg border px-4 py-3 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isUserSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`text-sm font-medium ${isUserSelected ? "text-primary" : "text-foreground"}`}
                  >
                    {userOption.label}
                  </span>
                  {activeSampleId == null && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {userOption.description}
                </p>
              </button>
            )}

            {userOption && <div className="border-t border-border" />}

            {profiles.map((profile) => {
              const isSelected = selected === profile.id;
              const isActive = activeSampleId === profile.id;
              const meta =
                profile.investmentCount != null
                  ? `${profile.investmentCount} investment${profile.investmentCount !== 1 ? "s" : ""}`
                  : profile.childCount != null
                    ? `${profile.childCount} child${profile.childCount !== 1 ? "ren" : ""}`
                    : null;

              return (
                <button
                  key={profile.id}
                  onClick={() => setSelected(profile.id)}
                  className={[
                    "w-full text-left rounded-lg border px-4 py-3 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                    >
                      {profile.label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                      {meta && (
                        <span className="text-xs text-muted-foreground">{meta}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {profile.description}
                  </p>
                </button>
              );
            })}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleLoad} disabled={!selected || loading}>
              {loading
                ? "Loading…"
                : isUserSelected
                  ? "Switch to my data"
                  : destructive
                    ? "Replace with this sample"
                    : "Load sample"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
