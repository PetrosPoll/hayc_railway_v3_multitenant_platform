/**
 * Greek all-caps must not keep tonos/diacritics (ΕΞΕΡΕΥΝΗΣΤΕ, not ΕΞΕΡΕΥΝΉΣΤΕ).
 * Sentence/title case (Εξερευνήστε, Ιστότοπος) keeps accents — do not use this helper there.
 */
export function toGreekSafeUpperCase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleUpperCase("el-GR");
}
