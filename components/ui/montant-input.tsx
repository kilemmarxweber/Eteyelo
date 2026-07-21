"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type Ref,
  type RefCallback,
} from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const montantFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatMontantDisplay(value: number | undefined) {
  if (value === undefined || value === null || value === 0) return "";
  return montantFormatter.format(Math.round(value));
}

function formatMontantFromDigits(digits: string): {
  display: string;
  value: number | undefined;
} {
  if (!digits) {
    return { display: "", value: undefined };
  }

  const numericValue = parseInt(digits, 10);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { display: "", value: undefined };
  }

  return {
    display: montantFormatter.format(numericValue),
    value: numericValue,
  };
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  };
}

function clearZeroOnFocus(
  value: number | undefined,
  onChange: (value: number | undefined) => void,
) {
  if (value === 0) {
    onChange(undefined);
  }
}

export type MontantInputProps = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const MontantInput = forwardRef<HTMLInputElement, MontantInputProps>(
  function MontantInput(
    {
      value,
      onChange,
      onBlur,
      name,
      placeholder = "0",
      disabled,
      className,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [digits, setDigits] = useState("");
    const [display, setDisplay] = useState(() => formatMontantDisplay(value));

    useEffect(() => {
      if (!isFocused) {
        setDisplay(formatMontantDisplay(value));
      }
    }, [value, isFocused]);

    const syncFromDigits = (nextDigits: string) => {
      const { display: nextDisplay, value: nextValue } =
        formatMontantFromDigits(nextDigits);

      setDigits(nextDigits);
      setDisplay(nextDisplay);
      onChange(nextValue);

      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        const position = el.value.length;
        el.setSelectionRange(position, position);
      });
    };

    const removeDigitBeforeCursor = () => {
      const el = inputRef.current;
      if (!el || digits.length === 0) {
        syncFromDigits("");
        return;
      }

      const selectionStart = el.selectionStart ?? 0;
      const selectionEnd = el.selectionEnd ?? 0;

      if (selectionStart !== selectionEnd) {
        syncFromDigits("");
        return;
      }

      const digitsBeforeCursor = el.value
        .slice(0, selectionStart)
        .replace(/\D/g, "").length;

      if (digitsBeforeCursor <= 0) {
        syncFromDigits("");
        return;
      }

      syncFromDigits(
        digits
          .split("")
          .filter((_, index) => index !== digitsBeforeCursor - 1)
          .join(""),
      );
    };

    return (
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        name={name}
        disabled={disabled}
        className={cn(className)}
        ref={mergeRefs(ref, inputRef)}
        value={display}
        onFocus={() => {
          if (disabled) return;
          setIsFocused(true);
          clearZeroOnFocus(value, onChange);

          const initialDigits =
            value && value > 0 ? String(Math.round(value)) : "";

          setDigits(initialDigits);
          setDisplay(
            initialDigits
              ? formatMontantFromDigits(initialDigits).display
              : "",
          );
        }}
        onBlur={() => {
          setIsFocused(false);
          const { display: nextDisplay, value: nextValue } =
            formatMontantFromDigits(digits);
          setDigits("");
          setDisplay(nextDisplay);
          onChange(nextValue);
          onBlur?.();
        }}
        onChange={() => {}}
        onPaste={(e) => {
          if (disabled) return;
          e.preventDefault();
          const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
          if (!pasted) return;
          syncFromDigits(`${digits}${pasted}`);
        }}
        onKeyDown={(e) => {
          if (!isFocused || disabled) return;

          if (/^\d$/.test(e.key)) {
            e.preventDefault();
            syncFromDigits(`${digits}${e.key}`);
            return;
          }

          if (e.key === "Backspace") {
            e.preventDefault();
            removeDigitBeforeCursor();
          }
        }}
      />
    );
  },
);
