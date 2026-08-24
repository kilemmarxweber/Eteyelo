const FR_UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

const PT_UNITS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezasseis",
  "dezassete",
  "dezoito",
  "dezanove",
];

const EN_UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function integerToPt(value: number): string {
  if (value < 20) return PT_UNITS[value] ?? String(value);
  if (value === 20) return "vinte";
  if (value < 30) return value === 21 ? "vinte e um" : `vinte e ${PT_UNITS[value - 20]}`;
  return String(value);
}

function integerToEn(value: number): string {
  if (value < 20) return EN_UNITS[value] ?? String(value);
  if (value === 20) return "twenty";
  if (value < 30) return `twenty-${EN_UNITS[value - 20]}`;
  return String(value);
}

function integerToFr(value: number): string {
  if (value <= 16) return FR_UNITS[value] ?? String(value);
  if (value < 20) return `dix-${FR_UNITS[value - 10]}`;
  if (value === 20) return "vingt";
  if (value === 21) return "vingt-et-un";
  if (value < 30) return `vingt-${FR_UNITS[value - 20]}`;
  return String(value);
}

export function numberToWords(
  value: number,
  locale: "fr" | "pt" | "en" = "fr",
): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? (locale === "en" ? "minus " : locale === "pt" ? "menos " : "moins ") : "";
  const abs = Math.abs(value);
  const integer = Math.trunc(abs);
  const tenths = Math.round((abs - integer) * 10);

  const integerWords =
    locale === "pt"
      ? integerToPt(integer)
      : locale === "en"
        ? integerToEn(integer)
        : integerToFr(integer);

  if (tenths <= 0) {
    return capitalize(`${sign}${integerWords}`);
  }

  const fractionWords =
    locale === "pt"
      ? integerToPt(tenths)
      : locale === "en"
        ? integerToEn(tenths)
        : integerToFr(tenths);
  const glue = locale === "pt" ? " vírgula " : locale === "en" ? " point " : " virgule ";
  return capitalize(`${sign}${integerWords}${glue}${fractionWords}`);
}
