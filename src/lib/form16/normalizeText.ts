/** Fix common OCR mangling before parsing Form 16. Safe on clean PDF text too. */
export function normalizeForm16Text(text: string): string {
  let t = text.replace(/\r\n/g, "\n");

  // OCR: single digits split by spaces "3 8 4 4 2 5 5" → "3844255"
  t = t.replace(/\b(\d(?:\s\d){5,})\b/g, (run) => run.replace(/\s/g, ""));

  // Section 17 labels
  t = t.replace(/\b(?:l|I|1)\s*7\s*[\(\[\{]?\s*1\s*[\)\]\}]/gi, "17(1)");
  t = t.replace(/\b17\s*[\(\[\{lI]?\s*1\s*[\)\]\}]/gi, "17(1)");
  t = t.replace(/\b17\s*[\(\[\{lI]?\s*2\s*[\)\]\}]/gi, "17(2)");
  t = t.replace(/\b17\s*[\(\[\{lI]?\s*3\s*[\)\]\}]/gi, "17(3)");

  // Chapter VI-A / section 10
  t = t.replace(/\b8\s*[oO0]\s*[cC]\b/g, "80C");
  t = t.replace(
    /\b80\s*[cC][cC]\s*[dD]\s*[\(\[\{]?\s*1\s*[Bb]?\s*[\)\]\}]/gi,
    "80CCD(1B)",
  );
  t = t.replace(/\b80\s*[cC][cC]\s*[dD]\s*[\(\[\{]?\s*2\s*[\)\]\}]/gi, "80CCD(2)");
  t = t.replace(/\b80\s*[dD]\b/g, "80D");
  t = t.replace(/\b80\s*[gG]\b/g, "80G");
  t = t.replace(/\b10\s*[\(\[\{]?\s*13\s*[Aa]\s*[\)\]\}]/gi, "10(13A)");
  t = t.replace(/\b16\s*[\(\[\{]?\s*[iI]{1,3}\s*[\)\]\}]/gi, "16(iii)");

  t = t.replace(/Form\s*1\s*6/gi, "Form 16");
  t = t.replace(/Gross\s+Sa[l1I]ary/gi, "Gross Salary");
  t = t.replace(/Profession[a]?l\s+Tax/gi, "Professional Tax");
  t = t.replace(/tax\s+deducted/gi, "tax deducted");
  t = t.replace(/T\s*D\s*S/gi, "TDS");

  return t;
}
