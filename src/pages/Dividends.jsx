import { useState, useEffect, useRef, useMemo, useDeferredValue, memo } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TrendingUp, Plus, Pencil, Trash2, Loader2, Upload } from "lucide-react";
import { parseFormatted, formatWithCommas } from "@/lib/formatNumber";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { buildMonthlyChartData, buildAnnualChartData } from "@/utils/dividendsChart";

// ── Callables ─────────────────────────────────────────────────────────────────

const callGetPlan = httpsCallable(functions, "dividendsGetPlan");
const callUpsertPayment = httpsCallable(functions, "dividendsUpsertPayment");
const callDeletePayment = httpsCallable(functions, "dividendsDeletePayment");
const callUpsertAccount = httpsCallable(functions, "dividendsUpsertAccount");
const callBatchImport = httpsCallable(functions, "dividendsBatchImport");

// ── Constants ─────────────────────────────────────────────────────────────────

const TAX_TYPES = [
  { value: "taxable", label: "Taxable" },
  { value: "traditional-ira", label: "Traditional IRA" },
  { value: "roth-ira", label: "Roth IRA" },
  { value: "other", label: "Other" },
];

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUSD(n) {
  if (n == null) return "—";
  return (
    "$" +
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
function fmtPct(r) {
  if (r == null) return "—";
  const sign = r >= 0 ? "+" : "";
  return sign + (r * 100).toFixed(2) + "%";
}
function fmtShares(n) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

// ── Dark mode hook ────────────────────────────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Year color palette ────────────────────────────────────────────────────────

const YEAR_COLORS = ["#94a3b8", "#22c55e", "#f59e0b", "#60a5fa", "#c084fc"];

// ── IncomeChart ───────────────────────────────────────────────────────────────

const TREND_COLOR = "#22c55e"; // green — matches primary

function IncomeChart({ monthlyChartData, annualChartData, view }) {
  const dark = useDarkMode();

  const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const axisColor = dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.40)";
  const tooltipBg = dark ? "#1e2433" : "#ffffff";
  const tooltipBorder = dark ? "#334155" : "#e2e8f0";

  const yFmt = (v) => (v === 0 ? "" : `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`);
  const dollarFmt = (v) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sharedTooltipStyle = {
    background: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 8,
    fontSize: 12,
  };

  if (view === "annual") {
    const data = annualChartData;
    if (data.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={yFmt}
            tick={{ fontSize: 11, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={sharedTooltipStyle}
            formatter={(v) => [dollarFmt(v), "Annual income"]}
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke={TREND_COLOR}
            strokeWidth={2.5}
            dot={{ r: 4, fill: TREND_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: TREND_COLOR, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Monthly grouped bar view
  const { data, years } = monthlyChartData;
  if (years.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="25%"
        barGap={2}
      >
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: axisColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={yFmt}
          tick={{ fontSize: 11, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
          contentStyle={sharedTooltipStyle}
          formatter={(value, name) => [dollarFmt(value), name]}
        />
        {years.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) => <span style={{ color: axisColor }}>{v}</span>}
          />
        )}
        {years.map((year, i) => (
          <Bar
            key={year}
            dataKey={String(year)}
            fill={YEAR_COLORS[i % YEAR_COLORS.length]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Import helpers ────────────────────────────────────────────────────────────

/** Convert an Excel serial date (e.g. 44330) or ISO string to YYYY-MM-DD */
function toISODate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    // Excel serial: days since 1899-12-30 (accounting for the 1900 leap-year bug)
    const ms = (value - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // Already looks like a date string — normalise to YYYY-MM-DD
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

const DATE_ALIASES = ["transactiondate", "date", "paydate", "paymentdate", "pay date"];
const TICKER_ALIASES = ["symbol", "ticker", "stock", "name"];
const AMOUNT_ALIASES = ["amount", "dividend", "income", "payment", "total"];

function detectColumns(headers) {
  const norm = headers.map((h) =>
    String(h ?? "")
      .toLowerCase()
      .replace(/\s+/g, "")
  );
  const find = (aliases) => {
    const idx = norm.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
    return idx === -1 ? null : idx;
  };
  return {
    dateIdx: find(DATE_ALIASES),
    tickerIdx: find(TICKER_ALIASES),
    amountIdx: find(AMOUNT_ALIASES),
  };
}

async function parseFile(file) {
  const { default: ExcelJS } = await import("exceljs/dist/exceljs.bare.min.js");
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], headers: [], mapping: {} };

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values.slice(1).map((v) => (v == null ? "" : String(v))));
  });

  if (rows.length < 2) {
    return { rows: [], headers: [], mapping: {} };
  }
  const headers = rows[0].map(String);
  const mapping = detectColumns(headers);
  const data = rows.slice(1).filter((r) => r.some((c) => c !== ""));
  return { headers, mapping, data };
}

// ── ImportDialog ──────────────────────────────────────────────────────────────

function ImportDialog({ open, onClose, onImported }) {
  const [step, setStep] = useState("pick"); // "pick" | "preview" | "done"
  const [parsedData, setParsedData] = useState(null); // { headers, mapping, data, payments }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { imported, skipped }
  const [fileError, setFileError] = useState(null);
  const fileRef = useRef(null);

  function reset() {
    setStep("pick");
    setParsedData(null);
    setImporting(false);
    setResult(null);
    setFileError(null);
  }

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFile(file) {
    setFileError(null);
    try {
      const { headers, mapping, data } = await parseFile(file);
      if (
        mapping.dateIdx == null ||
        mapping.tickerIdx == null ||
        mapping.amountIdx == null
      ) {
        setFileError(
          `Could not detect required columns. Found: ${headers.join(", ")}. ` +
            `Expected columns named Date/TransactionDate, Symbol/Ticker, and Amount.`
        );
        return;
      }
      const payments = data
        .map((row) => ({
          ticker: String(row[mapping.tickerIdx] ?? ""),
          date: toISODate(row[mapping.dateIdx]),
          amount: Number(row[mapping.amountIdx]),
        }))
        .filter((p) => p.ticker && p.date && p.amount > 0);

      setParsedData({ headers, mapping, data, payments });
      setStep("preview");
    } catch (err) {
      setFileError(err.message ?? "Failed to parse file.");
    }
  }

  async function handleImport() {
    if (!parsedData?.payments?.length) return;
    setImporting(true);
    try {
      const r = await callBatchImport({ payments: parsedData.payments });
      setResult({ imported: r.data.data.imported, skipped: r.data.data.skipped });
      onImported(r.data.data.plan);
      setStep("done");
    } catch (err) {
      setFileError(err.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const previewRows = parsedData?.payments?.slice(0, 8) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import payments</DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx) or CSV file. The file must have columns for
              <strong> Date</strong> (or TransactionDate), <strong>Symbol</strong> (or
              Ticker), and <strong>Amount</strong>. Existing payments with the same ticker
              + date are skipped.
            </p>
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-10 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Drop file here or <span className="text-primary">browse</span>
              </span>
              <span className="text-xs text-muted-foreground">.xlsx or .csv</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>
        )}

        {step === "preview" && parsedData && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Found <strong>{parsedData.payments.length.toLocaleString()}</strong> valid
              payments.
              {parsedData.data.length - parsedData.payments.length > 0 && (
                <>
                  {" "}
                  {(
                    parsedData.data.length - parsedData.payments.length
                  ).toLocaleString()}{" "}
                  rows skipped (missing or invalid fields).
                </>
              )}
            </p>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Ticker</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5 font-medium text-foreground">
                        {p.ticker}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{p.date}</td>
                      <td className="px-3 py-1.5 text-right text-foreground">
                        {fmtUSD(p.amount)}
                      </td>
                    </tr>
                  ))}
                  {parsedData.payments.length > 8 && (
                    <tr className="border-t border-border">
                      <td
                        colSpan={3}
                        className="px-3 py-1.5 text-center text-muted-foreground italic"
                      >
                        …and {(parsedData.payments.length - 8).toLocaleString()} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="text-4xl font-heading font-bold text-foreground">
              {result.imported.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              payments imported
              {result.skipped > 0 && (
                <> · {result.skipped.toLocaleString()} duplicates skipped</>
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "pick" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset} disabled={importing}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${parsedData.payments.length.toLocaleString()} payments`
                )}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PaymentDialog ─────────────────────────────────────────────────────────────

const EMPTY_PAYMENT = {
  ticker: "",
  date: "",
  amount: "",
  sharesHeld: "",
  priceAtDate: "",
  accountId: "",
  note: "",
};

function PaymentDialog({ open, data, accounts, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_PAYMENT);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(
        data
          ? {
              ticker: data.ticker ?? "",
              date: data.date ?? "",
              amount: data.amount != null ? formatWithCommas(String(data.amount)) : "",
              sharesHeld: data.sharesHeld != null ? String(data.sharesHeld) : "",
              priceAtDate: data.priceAtDate != null ? String(data.priceAtDate) : "",
              accountId: data.accountId ?? "",
              note: data.note ?? "",
            }
          : EMPTY_PAYMENT
      );
    }
  }, [open, data]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const amountNum = parseFormatted(form.amount);
  const isValid = form.ticker.trim() && form.date && amountNum > 0;

  function handleSave() {
    onSave({
      ...(data?.id ? { id: data.id } : {}),
      ticker: form.ticker.trim().toUpperCase(),
      date: form.date,
      amount: amountNum,
      sharesHeld: form.sharesHeld ? Number(form.sharesHeld) : null,
      priceAtDate: form.priceAtDate ? Number(form.priceAtDate) : null,
      accountId: form.accountId || null,
      note: form.note.trim() || null,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{data ? "Edit payment" : "Add payment"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Ticker *</Label>
              <Input
                value={form.ticker}
                onChange={(e) => set("ticker", e.target.value.toUpperCase())}
                placeholder="SCHD"
                maxLength={10}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Amount received *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                className="pl-6"
                value={form.amount}
                onChange={(e) => set("amount", formatWithCommas(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>
                Shares held <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="number"
                value={form.sharesHeld}
                onChange={(e) => set("sharesHeld", e.target.value)}
                placeholder="100.000"
                min="0"
                step="0.001"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Price at date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  className="pl-6"
                  type="number"
                  value={form.priceAtDate}
                  onChange={(e) => set("priceAtDate", e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>
                Account <span className="text-muted-foreground">(optional)</span>
              </Label>
              <select
                className={SELECT_CLASS}
                value={form.accountId}
                onChange={(e) => set("accountId", e.target.value)}
              >
                <option value="">— None —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="e.g. Q1 distribution"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? "Saving…" : data ? "Save changes" : "Add payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AccountDialog ─────────────────────────────────────────────────────────────

function AccountDialog({ open, data, onClose, onSave, saving }) {
  const [name, setName] = useState("");
  const [taxType, setTaxType] = useState("taxable");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(data?.name ?? "");
      setTaxType(data?.taxType ?? "taxable");
    }
  }, [open, data]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{data ? "Edit account" : "Add account"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Account name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E*Trade Taxable"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tax type</Label>
            <select
              className={SELECT_CLASS}
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
            >
              {TAX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({ ...(data?.id ? { id: data.id } : {}), name: name.trim(), taxType })
            }
            disabled={!name.trim() || saving}
          >
            {saving ? "Saving…" : data ? "Save" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── TickerSummaryCard ─────────────────────────────────────────────────────────

const TickerSummaryCard = memo(function TickerSummaryCard({
  ticker,
  stats,
  onFilterTicker,
  isFiltered,
}) {
  const growthColor =
    stats.dpsGrowthRate == null
      ? "text-muted-foreground"
      : stats.dpsGrowthRate >= 0
        ? "text-green-700 dark:text-green-400"
        : "text-destructive";

  return (
    <button
      onClick={() => onFilterTicker(isFiltered ? null : ticker)}
      className={[
        "w-full text-left rounded-lg border px-4 py-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isFiltered
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-heading font-semibold text-foreground">{ticker}</span>
        <span className={`text-xs font-medium ${growthColor}`}>
          {stats.dpsGrowthRate != null ? fmtPct(stats.dpsGrowthRate) + " DPS" : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs text-muted-foreground">
        <span>
          Total received:{" "}
          <span className="text-foreground font-medium">
            {fmtUSD(stats.totalReceived)}
          </span>
        </span>
        {stats.latestDPS != null && (
          <span>
            Latest DPS:{" "}
            <span className="text-foreground font-medium">{fmtUSD(stats.latestDPS)}</span>
          </span>
        )}
        {stats.totalSharesAcquired > 0 && (
          <span className="col-span-2">
            Shares acquired (DRIP):{" "}
            <span className="text-foreground font-medium">
              {fmtShares(stats.totalSharesAcquired)}
            </span>
          </span>
        )}
      </div>
    </button>
  );
});

// ── PaymentRow ────────────────────────────────────────────────────────────────

const PaymentRow = memo(function PaymentRow({ payment, accounts, onEdit, onDelete }) {
  const account = accounts.find((a) => a.id === payment.accountId);
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">{payment.ticker}</span>
          <span className="text-sm text-muted-foreground">{payment.date}</span>
          {account && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {account.name}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground mt-0.5">
          <span className="text-foreground font-medium">{fmtUSD(payment.amount)}</span>
          {payment.dividendPerShare != null && (
            <span>DPS: {fmtUSD(payment.dividendPerShare)}</span>
          )}
          {payment.sharesAcquired != null && (
            <span>+{fmtShares(payment.sharesAcquired)} shares</span>
          )}
          {payment.note && <span className="italic">{payment.note}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => onEdit(payment)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive"
          onClick={() => onDelete(payment)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

// ── Dividends (main page) ─────────────────────────────────────────────────────

export function Dividends() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterTicker, setFilterTicker] = useState(null);

  const [paymentDialog, setPaymentDialog] = useState({ open: false, data: null });
  const [accountDialog, setAccountDialog] = useState({ open: false, data: null });
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterAccount, setFilterAccount] = useState(null);
  const [chartView, setChartView] = useState("monthly"); // "monthly" | "annual"
  const [tickerSearch, setTickerSearch] = useState("");
  const [tickerSort, setTickerSort] = useState("name"); // "name" | "amount"
  const [paymentPage, setPaymentPage] = useState(0);

  const PAGE_SIZE = 25;

  useEffect(() => {
    callGetPlan({})
      .then((r) => setPlan(r.data.data.plan))
      .catch((e) => setError(e.message ?? "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSavePayment(payment) {
    try {
      setSaving(true);
      const r = await callUpsertPayment({ payment });
      setPlan(r.data.data.plan);
      setPaymentDialog({ open: false, data: null });
    } catch (e) {
      setError(e.message ?? "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePayment() {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      const r = await callDeletePayment({ paymentId: deleteTarget.id });
      setPlan(r.data.data.plan);
      setDeleteTarget(null);
    } catch (e) {
      setError(e.message ?? "Failed to delete.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAccount(account) {
    try {
      setSaving(true);
      const r = await callUpsertAccount({ account });
      setPlan(r.data.data.plan);
      setAccountDialog({ open: false, data: null });
    } catch (e) {
      setError(e.message ?? "Failed to save account.");
    } finally {
      setSaving(false);
    }
  }

  const accounts = plan?.accounts ?? [];
  const allPayments = useMemo(() => plan?.payments ?? [], [plan?.payments]);
  const tickerStats = useMemo(() => plan?.tickerStats ?? {}, [plan?.tickerStats]);
  const portfolio = plan?.portfolio;

  const sortedPayments = useMemo(() => {
    const filtered = filterTicker
      ? allPayments.filter((p) => p.ticker === filterTicker)
      : allPayments;
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [allPayments, filterTicker]);

  // Defer search so keystrokes stay instant while the 63-card grid re-renders lazily
  const deferredSearch = useDeferredValue(tickerSearch);

  // Memoize chart data — don't reprocess 1,100+ payments on every keystroke
  const monthlyChartData = useMemo(
    () => buildMonthlyChartData(allPayments, filterTicker, filterAccount),
    [allPayments, filterTicker, filterAccount]
  );
  const annualChartData = useMemo(
    () => buildAnnualChartData(allPayments, filterTicker, filterAccount),
    [allPayments, filterTicker, filterAccount]
  );

  const displayTickers = useMemo(() => {
    const search = deferredSearch.toLowerCase();
    let tickers = (portfolio?.allTickers ?? []).filter((t) =>
      t.toLowerCase().includes(search)
    );
    if (tickerSort === "amount") {
      tickers = [...tickers].sort(
        (a, b) =>
          (tickerStats[b]?.totalReceived ?? 0) - (tickerStats[a]?.totalReceived ?? 0)
      );
    }
    return tickers;
  }, [portfolio?.allTickers, deferredSearch, tickerSort, tickerStats]);

  const isEmpty = !plan || allPayments.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <h1
              className="font-heading font-bold tracking-tight text-foreground mb-1"
              style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}
            >
              Dividends
            </h1>
            <p className="text-muted-foreground text-sm">
              Track dividend income, DPS growth, and DRIP share accumulation.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAccountDialog({ open: true, data: null })}
            >
              Accounts
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button
              size="sm"
              onClick={() => setPaymentDialog({ open: true, data: null })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add payment
            </Button>
          </div>
        </div>
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
          <TrendingUp className="h-12 w-12 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground">No dividend payments yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Add your first payment to start tracking DPS growth and DRIP share
              accumulation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button onClick={() => setPaymentDialog({ open: true, data: null })}>
              <Plus className="h-4 w-4 mr-1" />
              Add payment
            </Button>
          </div>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && !isEmpty && (
        <div className="flex flex-col gap-8">
          {/* Portfolio summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Annual income</p>
                <div className="flex flex-col gap-1">
                  {[...annualChartData].reverse().map(({ year, income }) => {
                    const isCurrentYear = year === String(new Date().getFullYear());
                    return (
                      <div
                        key={year}
                        className="flex items-baseline justify-between gap-4"
                      >
                        <span className="text-xs text-muted-foreground">
                          {isCurrentYear ? `${year} YTD` : year}
                        </span>
                        <span className="font-heading font-semibold text-foreground tabular-nums">
                          {fmtUSD(income)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Tickers tracked</p>
                <p className="font-heading font-semibold text-foreground mt-0.5">
                  {portfolio?.allTickers?.length ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total payments</p>
                <p className="font-heading font-semibold text-foreground mt-0.5">
                  {portfolio?.paymentCount}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Income chart */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="font-heading font-semibold text-foreground">Income</h2>
                {/* View toggle */}
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {[
                    ["monthly", "Monthly"],
                    ["annual", "Annual"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setChartView(val)}
                      className={[
                        "px-3 py-1 transition-colors",
                        chartView === val
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {accounts.length > 0 && (
                  <select
                    className={SELECT_CLASS + " w-auto h-10 py-0"}
                    value={filterAccount ?? ""}
                    onChange={(e) => setFilterAccount(e.target.value || null)}
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                {(filterTicker || filterAccount) && (
                  <button
                    onClick={() => {
                      setFilterTicker(null);
                      setFilterAccount(null);
                      setPaymentPage(0);
                    }}
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
            <Card>
              <CardContent className="pt-4 pb-3 pr-3">
                <IncomeChart
                  monthlyChartData={monthlyChartData}
                  annualChartData={annualChartData}
                  view={chartView}
                />
              </CardContent>
            </Card>
          </div>

          {/* Ticker cards */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h2 className="font-heading font-semibold text-foreground">By ticker</h2>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search ticker…"
                  value={tickerSearch}
                  onChange={(e) => setTickerSearch(e.target.value)}
                  className="w-full sm:w-40 h-10 text-sm"
                />
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {[
                    ["name", "Name"],
                    ["amount", "Amount"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setTickerSort(val)}
                      className={[
                        "px-3 py-1 transition-colors",
                        tickerSort === val
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {displayTickers.length === 0 && (portfolio?.allTickers?.length ?? 0) > 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No tickers match "{tickerSearch}"
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayTickers.map((ticker) => (
                  <TickerSummaryCard
                    key={ticker}
                    ticker={ticker}
                    stats={tickerStats[ticker]}
                    onFilterTicker={(t) => {
                      setFilterTicker(t);
                      setPaymentPage(0);
                    }}
                    isFiltered={filterTicker === ticker}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Payment history */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-semibold text-foreground">
                {filterTicker ? `${filterTicker} payments` : "All payments"}
              </h2>
            </div>
            <Card>
              <CardContent className="pt-4 pb-1">
                {sortedPayments
                  .slice(paymentPage * PAGE_SIZE, (paymentPage + 1) * PAGE_SIZE)
                  .map((p) => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      accounts={accounts}
                      onEdit={(payment) =>
                        setPaymentDialog({ open: true, data: payment })
                      }
                      onDelete={setDeleteTarget}
                    />
                  ))}
              </CardContent>
            </Card>
            {sortedPayments.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {paymentPage * PAGE_SIZE + 1}–
                  {Math.min((paymentPage + 1) * PAGE_SIZE, sortedPayments.length)} of{" "}
                  {sortedPayments.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-sm"
                    disabled={paymentPage === 0}
                    onClick={() => setPaymentPage((p) => p - 1)}
                  >
                    ← Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-sm"
                    disabled={(paymentPage + 1) * PAGE_SIZE >= sortedPayments.length}
                    onClick={() => setPaymentPage((p) => p + 1)}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(plan) => {
          setPlan(plan);
          setImportOpen(false);
        }}
      />

      {/* Dialogs */}
      <PaymentDialog
        open={paymentDialog.open}
        data={paymentDialog.data}
        accounts={accounts}
        onClose={() => setPaymentDialog({ open: false, data: null })}
        onSave={handleSavePayment}
        saving={saving}
      />

      <AccountDialog
        open={accountDialog.open}
        data={accountDialog.data}
        onClose={() => setAccountDialog({ open: false, data: null })}
        onSave={handleSaveAccount}
        saving={saving}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v && !saving) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete the <strong>{deleteTarget?.ticker}</strong> payment of{" "}
            <strong>{fmtUSD(deleteTarget?.amount)}</strong> on {deleteTarget?.date}? This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={saving}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
