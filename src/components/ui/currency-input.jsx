import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { formatWithCommas } from "@/lib/formatNumber";

/**
 * A controlled text input that formats the value with commas as the user types.
 * `onChange` is called with the formatted string value (not a synthetic event).
 * Use `parseFormatted(value)` from @/lib/formatNumber to get the numeric value on submit.
 */
export const CurrencyInput = forwardRef(function CurrencyInput({ value, onChange, ...props }, ref) {
  function handleChange(e) {
    const raw = e.target.value.replace(/,/g, "");
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      onChange?.(formatWithCommas(raw));
    }
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      {...props}
    />
  );
});
