/**
 * Format a number string with commas as the user types.
 * Strips commas first, then re-inserts them at thousands boundaries.
 * Preserves a trailing decimal point so the user can type decimals.
 */
export function formatWithCommas(raw) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const str = String(raw).replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(str)) return String(raw); // invalid — return as-is
  const [integer, decimal] = str.split(".");
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

/** Strip commas and parse to a float. Returns 0 for empty/invalid input. */
export function parseFormatted(value) {
  return parseFloat(String(value || "").replace(/,/g, "")) || 0;
}

/** onChange handler for currency inputs. Call with the raw e.target.value. */
export function onCurrencyChange(setValue) {
  return (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      setValue(formatWithCommas(raw));
    }
  };
}
