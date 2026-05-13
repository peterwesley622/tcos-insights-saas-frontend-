"use client";

/**
 * EmailListInput — one input row per email with a per-row remove button
 * and an "Add another email" button at the bottom. Used by both admin
 * (new + edit client) and portal (settings) pages so multi-owner clients
 * can manage their address list without juggling semicolon delimiters.
 *
 * The component owns no state of its own — the parent passes in the
 * current list and an onChange callback. To submit to the backend, the
 * parent should filter empty rows and join with "; " (the storage
 * format the existing _parse_owner_emails helper already understands).
 *
 * Always renders at least one input row so a freshly-loaded client with
 * no owner emails still gets a visible empty slot to type into.
 */
export function EmailListInput({
  values,
  onChange,
  inputClassName,
  placeholder = "owner@example.com",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  inputClassName?: string;
  placeholder?: string;
}) {
  const displayed = values.length > 0 ? values : [""];

  function setAt(idx: number, value: string) {
    const next = [...displayed];
    next[idx] = value;
    onChange(next);
  }

  function removeAt(idx: number) {
    const next = displayed.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [""]);
  }

  function addRow() {
    onChange([...displayed, ""]);
  }

  const inputCls =
    inputClassName ??
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <div className="space-y-2">
      {displayed.map((email, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setAt(idx, e.target.value)}
            placeholder={placeholder}
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => removeAt(idx)}
            // The trash button is always available; remove-on-only-row
            // clears the value rather than dropping the row, so the
            // user is never left with no input to type into.
            aria-label="Remove email"
            title="Remove this email"
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-2 text-slate-500 hover:bg-slate-50 hover:text-red-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
      >
        <span aria-hidden>+</span>
        <span>Add another email</span>
      </button>
    </div>
  );
}

/**
 * Parse a semicolon-separated owner_emails string from the API into a
 * clean list (commas tolerated as a separator, duplicates dropped,
 * whitespace trimmed). Mirrors the backend's _parse_owner_emails helper.
 */
export function parseOwnerEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.replace(/,/g, ";").split(";")) {
    const addr = part.trim();
    if (!addr || !addr.includes("@")) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

/**
 * Inverse of parseOwnerEmails — take what the EmailListInput emits and
 * produce the storage string (or null when there's nothing valid).
 */
export function serializeOwnerEmails(list: string[]): string | null {
  const clean = list
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes("@"));
  return clean.length > 0 ? clean.join("; ") : null;
}
