import { useLayoutEffect, useRef, useState } from "react";
import { formatRoubleInput } from "../lib/money";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "inputMode"> & {
  /** Digits-only rouble string (controlled mode). */
  value?: string;
  /** Digits-only rouble string (uncontrolled mode). */
  defaultValue?: string;
  /** Receives digits only, without separators. */
  onChange?: (digits: string) => void;
};

/** Rouble amount input: shows "3 000" while the value stays "3000"; keeps the caret in place across reformatting. */
export function AmountInput({ value, defaultValue, onChange, ...rest }: Props) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const digits = value ?? inner;
  const ref = useRef<HTMLInputElement>(null);
  // Number of digits left of the caret, to restore its position after the value is reformatted.
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caretDigits.current === null || document.activeElement !== el) return;
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < caretDigits.current; pos++) {
      if (/\d/.test(el.value[pos])) seen++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatRoubleInput(digits)}
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
        const next = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        if (value === undefined) setInner(next);
        onChange?.(next);
      }}
    />
  );
}
