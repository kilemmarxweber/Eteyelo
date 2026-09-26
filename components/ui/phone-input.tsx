import { CheckIcon, ChevronsUpDown } from "lucide-react";

import * as React from "react";

import * as RPNInput from "react-phone-number-input";

import flags from "react-phone-number-input/flags";

import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { inputVariants, type InputProps } from "./input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

import { ScrollArea } from "./scroll-area";
import { cn } from "@/lib/utils"

/** Chiffres du numéro national (hors indicatif), ex. 81 234 56 78. */
export const PHONE_NATIONAL_DIGIT_LIMIT = 9;

type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "maxLength"
> &
  Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & {
    onChange?: (value: RPNInput.Value) => void;
  };

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function limitE164NationalDigits(
  value: string | undefined,
  country?: RPNInput.Country,
): string {
  if (!value) return "";
  const callingCode = country ? RPNInput.getCountryCallingCode(country) : "";
  if (!callingCode) {
    const prefix = value.startsWith("+") ? "+" : "";
    return `${prefix}${value.replace(/\D/g, "").slice(0, PHONE_NATIONAL_DIGIT_LIMIT)}`;
  }
  const prefix = `+${callingCode}`;
  const national = (
    value.startsWith(prefix) ? value.slice(prefix.length) : value.replace(/^\+\d+/, "")
  )
    .replace(/\D/g, "")
    .slice(0, PHONE_NATIONAL_DIGIT_LIMIT);
  return national ? `${prefix}${national}` : prefix;
}

const PhoneInput: React.ForwardRefExoticComponent<PhoneInputProps> =
  React.forwardRef<React.ElementRef<typeof RPNInput.default>, PhoneInputProps>(
    (
      {
        className,
        onChange,
        onCountryChange,
        defaultCountry = "CD",
        ...props
      },
      ref,
    ) => {
      const countryRef = React.useRef<RPNInput.Country | undefined>(
        defaultCountry,
      );

      return (
        <RPNInput.default
          {...props}
          ref={ref}
          className={cn(
            "flex h-10 w-full items-stretch",
            "[&_.PhoneInputCountry]:flex [&_.PhoneInputCountry]:h-10 [&_.PhoneInputCountry]:shrink-0 [&_.PhoneInputCountry]:items-stretch",
            "[&_.PhoneInputInput]:h-10 [&_.PhoneInputInput]:min-h-10",
            className,
          )}
          flagComponent={FlagComponent}
          countrySelectComponent={CountrySelect}
          inputComponent={InputComponent}
          defaultCountry={defaultCountry}
          onCountryChange={(next) => {
            countryRef.current = next ?? defaultCountry;
            onCountryChange?.(next);
          }}
          onChange={(value) => {
            const limited = limitE164NationalDigits(
              value,
              countryRef.current,
            );
            onChange?.((limited || "") as RPNInput.Value);
          }}
        />
      );
    },
  );
PhoneInput.displayName = "PhoneInput";

const InputComponent = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, onKeyDown, onBeforeInput, onPaste, ...props }, ref) => {
    function wouldExceedLimit(nextValue: string): boolean {
      return countDigits(nextValue) > PHONE_NATIONAL_DIGIT_LIMIT;
    }

    function nextFromInsertion(input: HTMLInputElement, inserted: string): string {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      return input.value.slice(0, start) + inserted + input.value.slice(end);
    }

    // Input brut (sans wrapper) pour aligner pile avec le bouton pays en h-10
    return (
      <input
        className={cn(
          inputVariants({ inputSize: "default" }),
          "h-10 min-h-10 flex-1 rounded-e-lg rounded-s-none",
          className,
        )}
        inputMode="numeric"
        {...props}
        ref={ref}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (event.key.length !== 1 || !/\d/.test(event.key)) return;
          if (wouldExceedLimit(nextFromInsertion(event.currentTarget, event.key))) {
            event.preventDefault();
          }
        }}
        onBeforeInput={(event) => {
          onBeforeInput?.(event);
          if (event.defaultPrevented) return;
          const data = (event.nativeEvent as InputEvent).data;
          if (!data || !/\d/.test(data)) return;
          if (wouldExceedLimit(nextFromInsertion(event.currentTarget, data))) {
            event.preventDefault();
          }
        }}
        onPaste={(event) => {
          onPaste?.(event);
          if (event.defaultPrevented) return;
          const pasted = event.clipboardData.getData("text");
          if (!pasted) return;
          const start = event.currentTarget.selectionStart ?? 0;
          const end = event.currentTarget.selectionEnd ?? 0;
          const withoutSelection =
            event.currentTarget.value.slice(0, start) +
            event.currentTarget.value.slice(end);
          const remaining =
            PHONE_NATIONAL_DIGIT_LIMIT - countDigits(withoutSelection);
          if (remaining <= 0) {
            event.preventDefault();
            return;
          }
          const pastedDigits = (pasted.match(/\d/g) ?? []).join("");
          if (pastedDigits.length > remaining) {
            event.preventDefault();
            const keep = pastedDigits.slice(0, remaining);
            event.currentTarget.setRangeText(keep, start, end, "end");
            event.currentTarget.dispatchEvent(
              new Event("input", { bubbles: true }),
            );
          }
        }}
      />
    );
  },
);
InputComponent.displayName = "InputComponent";

type CountrySelectOption = { label: string; value: RPNInput.Country };

type CountrySelectProps = {
  disabled?: boolean;
  value: RPNInput.Country;
  onChange: (value: RPNInput.Country) => void;
  options: CountrySelectOption[];
};

const CountrySelect = ({
  disabled,
  value,
  onChange,
  options,
}: CountrySelectProps) => {
  const handleSelect = React.useCallback(
    (country: RPNInput.Country) => {
      onChange(country);
    },
    [onChange],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={cn(
            "h-10 min-h-10 shrink-0 gap-1 rounded-e-none rounded-s-lg px-3 py-0",
          )}
          disabled={disabled}
        >
          <FlagComponent country={value} countryName={value} />
          <ChevronsUpDown
            className={cn(
              "-mr-2 h-4 w-4 opacity-50",
              disabled ? "hidden" : "opacity-100",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList>
            <ScrollArea className="h-72">
              <CommandInput placeholder="Search country..." />
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {options
                  .filter((x) => x.value)
                  .map((option) => (
                    <CommandItem
                      className="gap-2"
                      key={option.value}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <FlagComponent
                        country={option.value}
                        countryName={option.label}
                      />
                      <span className="flex-1 text-sm">{option.label}</span>
                      {option.value && (
                        <span className="text-foreground/50 text-sm">
                          {`+${RPNInput.getCountryCallingCode(option.value)}`}
                        </span>
                      )}
                      <CheckIcon
                        className={cn(
                          "ml-auto h-4 w-4",
                          option.value === value ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
  const Flag = flags[country];

  return (
    <span className="bg-foreground/20 flex h-4 w-6 overflow-hidden rounded-sm">
      {Flag && <Flag title={countryName} />}
    </span>
  );
};
FlagComponent.displayName = "FlagComponent";

export { PhoneInput };
