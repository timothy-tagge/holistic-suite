import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Layers, Pencil, Trash2, ChevronDown, ChevronUp, Plus, Loader2 } from "lucide-react";
import { parseFormatted, formatWithCommas } from "@/lib/formatNumber";

// ── Constants ────────────────────────────────────────────────────────────────

const CF_TYPE_LABELS = {
  call: "Capital call",
  "distribution-income": "Distribution — income",
  "distribution-roc": "Distribution — return of capital",
  exit: "Exit proceeds",
};
const CF_TYPES = Object.entries(CF_TYPE_LABELS).map(([value, label]) => ({ value, label }));

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtUSD(n) {
  return n == null ? "—" : "$" + Math.round(n).toLocaleString();
}
function fmtIRR(r) {
  return r == null ? "—" : (r * 100).toFixed(1) + "%";
}
function fmtDPI(d) {
  return d == null ? "—" : d.toFixed(2) + "×";
}
function fmtDelta(computed, projected) {
  if (computed == null || projected == null) return "—";
  const pp = (computed - projected) * 100;
  return (pp >= 0 ? "+" : "") + pp.toFixed(1) + " pp";
}
function deltaClass(computed, projected) {
  if (computed == null || projected == null) return "text-muted-foreground";
  return computed >= projected ? "text-green-700 dark:text-green-400" : "text-destructive";
}
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Firebase callable helpers ────────────────────────────────────────────────

const callAltsGetPlan = httpsCallable(functions, "altsGetPlan");
const callAltsUpsertInvestment = httpsCallable(functions, "altsUpsertInvestment");
const callAltsDeleteInvestment = httpsCallable(functions, "altsDeleteInvestment");
const callAltsUpsertCashFlow = httpsCallable(functions, "altsUpsertCashFlow");
const callAltsDeleteCashFlow = httpsCallable(functions, "altsDeleteCashFlow");

// ── InvestmentDialog ─────────────────────────────────────────────────────────

function InvestmentDialog({ open, data, onClose, onSave, saving }) {
  const isEdit = !!data?.id;
  const [name, setName] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [vintage, setVintage] = useState("");
  const [committed, setCommitted] = useState("");
  const [projectedIRR, setProjectedIRR] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(data?.name ?? "");
      setSponsor(data?.sponsor ?? "");
      setVintage(data?.vintage != null ? String(data.vintage) : "");
      setCommitted(data?.committed != null ? formatWithCommas(String(data.committed)) : "");
      setProjectedIRR(
        data?.projectedIRR != null ? String((data.projectedIRR * 100).toFixed(1)) : ""
      );
      setStatus(data?.status ?? "active");
      setError(null);
    }
  }, [open, data]);

  function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const committedNum = parseFormatted(committed);
    if (!committedNum || committedNum <= 0) {
      setError("Committed capital must be a positive number.");
      return;
    }
    setError(null);
    const projectedIRRNum = projectedIRR !== "" ? parseFloat(projectedIRR) / 100 : null;
    onSave({
      ...(isEdit ? { id: data.id } : {}),
      name: name.trim(),
      sponsor: sponsor.trim() || null,
      vintage: vintage ? parseInt(vintage, 10) : null,
      committed: committedNum,
      projectedIRR: projectedIRRNum,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit investment" : "Add investment"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-name">Name *</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ashcroft Value-Add Fund V"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-sponsor">Sponsor</Label>
            <Input
              id="inv-sponsor"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              placeholder="e.g. Ashcroft Capital"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-vintage">Vintage year</Label>
              <Input
                id="inv-vintage"
                type="number"
                value={vintage}
                onChange={(e) => setVintage(e.target.value)}
                placeholder="e.g. 2021"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-committed">Committed capital *</Label>
              <CurrencyInput
                id="inv-committed"
                value={committed}
                onChange={setCommitted}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-projected-irr">Projected IRR %</Label>
            <Input
              id="inv-projected-irr"
              type="number"
              value={projectedIRR}
              onChange={(e) => setProjectedIRR(e.target.value)}
              placeholder="e.g. 18"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={status === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatus("active")}
              >
                Active
              </Button>
              <Button
                type="button"
                variant={status === "realized" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatus("realized")}
              >
                Realized
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CashFlowDialog ───────────────────────────────────────────────────────────

function CashFlowDialog({ open, data, onClose, onSave, saving }) {
  const isEdit = !!data?.id;
  const [date, setDate] = useState("");
  const [type, setType] = useState("call");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setDate(data?.date ?? "");
      setType(data?.type ?? "call");
      setAmount(data?.amount != null ? formatWithCommas(String(data.amount)) : "");
      setNote(data?.note ?? "");
      setError(null);
    }
  }, [open, data]);

  function handleSave() {
    if (!date) {
      setError("Date is required.");
      return;
    }
    const amountNum = parseFormatted(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    setError(null);
    onSave({
      ...(isEdit ? { id: data.id } : {}),
      date,
      type,
      amount: amountNum,
      note: note.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit cash flow" : "Add cash flow"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-date">Date *</Label>
            <Input
              id="cf-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-type">Type *</Label>
            <select
              id="cf-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CF_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-amount">
              Amount *{" "}
              <span className="text-muted-foreground font-normal">
                (calls and distributions both entered as positive amounts)
              </span>
            </Label>
            <CurrencyInput
              id="cf-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-note">Note</Label>
            <Input
              id="cf-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── DeleteDialog ─────────────────────────────────────────────────────────────

function DeleteDialog({ open, title, description, onClose, onConfirm, confirming }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirming}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={confirming}>
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CashFlowRow ──────────────────────────────────────────────────────────────

function CashFlowRow({ cf, onEdit, onDelete }) {
  const isCall = cf.type === "call";
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 text-sm text-muted-foreground whitespace-nowrap">
        {fmtDate(cf.date)}
      </td>
      <td className="py-2 pr-4 text-sm">{CF_TYPE_LABELS[cf.type] ?? cf.type}</td>
      <td className={`py-2 pr-4 text-sm font-mono tabular-nums ${isCall ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
        {isCall ? `(${fmtUSD(cf.amount)})` : fmtUSD(cf.amount)}
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground">{cf.note ?? ""}</td>
      <td className="py-2 text-right whitespace-nowrap">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cf)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(cf)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ── InvestmentCard ───────────────────────────────────────────────────────────

function InvestmentCard({ inv, expanded, onToggleExpand, onEdit, onDelete, onAddCF, onEditCF, onDeleteCF }) {
  const m = inv.metrics;
  const cfCount = (inv.cashFlows ?? []).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={inv.status === "realized" ? "secondary" : "outline"}>
                {inv.status === "realized" ? "Realized" : "Active"}
              </Badge>
              <CardTitle className="text-base">{inv.name}</CardTitle>
            </div>
            {(inv.sponsor || inv.vintage) && (
              <p className="text-sm text-muted-foreground">
                {[inv.sponsor, inv.vintage].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(inv)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(inv)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Committed", value: fmtUSD(inv.committed) },
            { label: "Called", value: fmtUSD(m.totalCalled) },
            { label: "Distributions", value: fmtUSD(m.totalDistributions) },
            { label: "DPI", value: fmtDPI(m.dpi) },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-sm font-mono tabular-nums font-medium">{item.value}</span>
            </div>
          ))}
        </div>

        {/* IRR comparison strip */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Projected IRR</span>
            <span className="text-sm font-mono tabular-nums">{fmtIRR(inv.projectedIRR)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Actual IRR</span>
            <span className="text-sm font-mono tabular-nums">{fmtIRR(m.computedIRR)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Delta</span>
            <span className={`text-sm font-mono tabular-nums ${deltaClass(m.computedIRR, inv.projectedIRR)}`}>
              {fmtDelta(m.computedIRR, inv.projectedIRR)}
            </span>
          </div>
        </div>

        {/* Cash flows toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="self-start -ml-2 text-muted-foreground"
          onClick={onToggleExpand}
        >
          {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          {cfCount === 0 ? "No cash flows" : `${cfCount} cash flow${cfCount !== 1 ? "s" : ""}`}
        </Button>

        {/* Expanded cash flows */}
        {expanded && (
          <div className="flex flex-col gap-3">
            {cfCount > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {(inv.cashFlows ?? []).map((cf) => (
                      <CashFlowRow
                        key={cf.id}
                        cf={cf}
                        onEdit={onEditCF}
                        onDelete={onDeleteCF}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No cash flows recorded yet.</p>
            )}
            <Button variant="outline" size="sm" className="self-start" onClick={onAddCF}>
              <Plus className="h-4 w-4 mr-1" />
              Add cash flow
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── PortfolioSummary ─────────────────────────────────────────────────────────

function PortfolioSummary({ portfolio }) {
  const items = [
    { label: "Total Committed", value: fmtUSD(portfolio.totalCommitted) },
    { label: "Total Called", value: fmtUSD(portfolio.totalCalled) },
    { label: "Distributions", value: fmtUSD(portfolio.totalDistributions) },
    { label: "DPI", value: fmtDPI(portfolio.portfolioDPI) },
    { label: "Blended IRR", value: fmtIRR(portfolio.blendedIRR) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 rounded-xl bg-muted/40 p-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-base font-mono tabular-nums font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Alts (main page) ─────────────────────────────────────────────────────────

export function Alts() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [invDialog, setInvDialog] = useState({ open: false, data: null });
  const [cfDialog, setCFDialog] = useState({ open: false, investmentId: null, data: null });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: null,
    investmentId: null,
    cashFlowId: null,
    label: "",
  });
  const [saving, setSaving] = useState(false);

  // Load plan on mount
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await callAltsGetPlan({});
        setPlan(result.data.data.plan);
      } catch (e) {
        setError(e.message ?? "Failed to load plan.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleToggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // Investment mutations
  async function handleSaveInvestment(investment) {
    try {
      setSaving(true);
      const result = await callAltsUpsertInvestment({ investment });
      setPlan(result.data.data.plan);
      setInvDialog({ open: false, data: null });
    } catch (e) {
      setError(e.message ?? "Failed to save investment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteInvestment() {
    const { investmentId } = deleteDialog;
    try {
      setSaving(true);
      const result = await callAltsDeleteInvestment({ investmentId });
      setPlan(result.data.data.plan);
      setDeleteDialog({ open: false, type: null, investmentId: null, cashFlowId: null, label: "" });
    } catch (e) {
      setError(e.message ?? "Failed to delete investment.");
    } finally {
      setSaving(false);
    }
  }

  // Cash flow mutations
  async function handleSaveCashFlow(cashFlow) {
    const { investmentId } = cfDialog;
    try {
      setSaving(true);
      const result = await callAltsUpsertCashFlow({ investmentId, cashFlow });
      setPlan(result.data.data.plan);
      setCFDialog({ open: false, investmentId: null, data: null });
    } catch (e) {
      setError(e.message ?? "Failed to save cash flow.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCashFlow() {
    const { investmentId, cashFlowId } = deleteDialog;
    try {
      setSaving(true);
      const result = await callAltsDeleteCashFlow({ investmentId, cashFlowId });
      setPlan(result.data.data.plan);
      setDeleteDialog({ open: false, type: null, investmentId: null, cashFlowId: null, label: "" });
    } catch (e) {
      setError(e.message ?? "Failed to delete cash flow.");
    } finally {
      setSaving(false);
    }
  }

  const investments = plan?.investments ?? [];
  const isEmpty = !plan || investments.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:px-6">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="font-heading font-bold tracking-tight text-foreground mb-1"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}
        >
          Alts
        </h1>
        <p className="text-muted-foreground text-sm">
          Track alternative investments — compare projected vs actual performance.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && isEmpty && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Layers className="h-12 w-12 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold text-lg text-foreground">No investments yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first investment to start tracking performance.
            </p>
          </div>
          <Button onClick={() => setInvDialog({ open: true, data: null })}>
            <Plus className="h-4 w-4 mr-2" />
            Add investment
          </Button>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && !isEmpty && (
        <div className="flex flex-col gap-6">
          {/* Portfolio summary */}
          <PortfolioSummary portfolio={plan.portfolio} />

          {/* Investments section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-foreground">Investments</h2>
              <Button
                size="sm"
                onClick={() => setInvDialog({ open: true, data: null })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add investment
              </Button>
            </div>

            {investments.map((inv) => (
              <InvestmentCard
                key={inv.id}
                inv={inv}
                expanded={expandedId === inv.id}
                onToggleExpand={() => handleToggleExpand(inv.id)}
                onEdit={(i) => setInvDialog({ open: true, data: i })}
                onDelete={(i) =>
                  setDeleteDialog({
                    open: true,
                    type: "investment",
                    investmentId: i.id,
                    cashFlowId: null,
                    label: i.name,
                  })
                }
                onAddCF={() => setCFDialog({ open: true, investmentId: inv.id, data: null })}
                onEditCF={(cf) => setCFDialog({ open: true, investmentId: inv.id, data: cf })}
                onDeleteCF={(cf) =>
                  setDeleteDialog({
                    open: true,
                    type: "cashFlow",
                    investmentId: inv.id,
                    cashFlowId: cf.id,
                    label: `${CF_TYPE_LABELS[cf.type] ?? cf.type} on ${fmtDate(cf.date)}`,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <InvestmentDialog
        open={invDialog.open}
        data={invDialog.data}
        onClose={() => setInvDialog({ open: false, data: null })}
        onSave={handleSaveInvestment}
        saving={saving}
      />

      <CashFlowDialog
        open={cfDialog.open}
        data={cfDialog.data}
        onClose={() => setCFDialog({ open: false, investmentId: null, data: null })}
        onSave={handleSaveCashFlow}
        saving={saving}
      />

      <DeleteDialog
        open={deleteDialog.open}
        title={
          deleteDialog.type === "investment"
            ? "Delete investment"
            : "Delete cash flow"
        }
        description={
          deleteDialog.type === "investment"
            ? `Delete "${deleteDialog.label}" and all its cash flows? This cannot be undone.`
            : `Delete "${deleteDialog.label}"? This cannot be undone.`
        }
        onClose={() =>
          setDeleteDialog({
            open: false,
            type: null,
            investmentId: null,
            cashFlowId: null,
            label: "",
          })
        }
        onConfirm={
          deleteDialog.type === "investment" ? handleDeleteInvestment : handleDeleteCashFlow
        }
        confirming={saving}
      />
    </div>
  );
}
