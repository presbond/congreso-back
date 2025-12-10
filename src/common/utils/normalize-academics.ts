// src/common/utils/normalize-academics.ts
export function normalizeGrade(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();

  // Mantener sólo dígitos; “1°”, “1ro”, “1er” => “1”
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;

  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return null;

  // Sólo 1..10 (10 es el único caso de 2 dígitos)
  if (n >= 1 && n <= 10) return String(n);
  return null;
}

export function normalizeGroup(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();

  // Primer letra A-Z
  const m = s.match(/[A-Z]/);
  return m ? m[0] : null;
}

/** Permite entrada tipo "1A", "2-B", "3° a", "10 C" y separa grado/grupo. */
export function splitGradeGroup(raw?: string | null): { grade: string | null; group: string | null } {
  if (!raw) return { grade: null, group: null };
  const s = String(raw).trim().toUpperCase();

  // Extrae dígitos (para grado) y una letra (para grupo)
  const grade = normalizeGrade(s);
  const groupMatch = s.match(/[A-Z]/);
  const group = groupMatch ? groupMatch[0] : null;

  return { grade, group };
}

/** Construye condición AND de términos; cada término se busca en varios campos (OR). */
export function buildMultiTermSearch(terms: string[]) {
  const safeTerms = terms
    .map(t => t.trim())
    .filter(Boolean);

  if (!safeTerms.length) return undefined;

  const perTermOr = (term: string) => ({
    OR: [
      { name_user:          { contains: term, mode: 'insensitive' as const } },
      { paternal_surname:   { contains: term, mode: 'insensitive' as const } },
      { maternal_surname:   { contains: term, mode: 'insensitive' as const } },
      { email:              { contains: term, mode: 'insensitive' as const } },
      { phone:              { contains: term, mode: 'insensitive' as const } },
      { matricula:          { contains: term, mode: 'insensitive' as const } },
      { educational_program:{ contains: term, mode: 'insensitive' as const } },
      { provenance:         { contains: term, mode: 'insensitive' as const } },
      // Búsqueda por grado/grupo si alguien escribe “2A”, etc.
      { grade:              { equals: normalizeGrade(term) ?? undefined } as any },
      { group_user:         { equals: normalizeGroup(term) ?? undefined } as any },
    ]
  });

  return {
    AND: safeTerms.map(perTermOr),
  };
}
