export const observationKeywords = [
  {
    id: 'vacacion',
    label: 'Justificada - vacacion',
    category: 'vacaciones',
    patterns: ['vacaciones'],
  },
  {
    id: 'licencia',
    label: 'Justificada - licencia',
    category: 'licencias',
    patterns: ['licencia'],
  },
  {
    id: 'permiso',
    label: 'Justificada - permiso',
    category: 'permisos',
    patterns: ['permiso'],
  },
  {
    id: 'ausencia',
    label: 'Justificada - ausencia',
    category: 'ausenciasJustificadas',
    patterns: ['ausencia'],
  },
  {
    id: 'tardanza',
    label: 'Justificada - tardanza',
    category: 'tardanzasJustificadas',
    patterns: ['tardanza'],
  },
  {
    id: 'ver-viatico',
    label: 'Justificada - trabajo externo',
    category: 'verViatico',
    patterns: ['ver viatico'],
    fullDayWorked: true,
    state: 'Trabajo externo / Ver viatico',
  },
  {
    id: 'feriado',
    label: 'Feriado',
    category: 'feriado',
    patterns: ['feriado'],
    excludedWorkday: true,
    state: 'Feriado',
  },
];

export function normalizeObservation(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/vi.tico/g, 'viatico')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyObservation(value = '') {
  const normalized = normalizeObservation(value);

  if (!normalized) {
    return {
      raw: '',
      normalized,
      isJustified: false,
      matches: [],
      primary: null,
      processedLabel: 'Sin observacion valida',
    };
  }

  const matches = observationKeywords.filter((keyword) =>
    keyword.patterns.some((pattern) => normalized.includes(pattern)),
  );

  return {
    raw: String(value),
    normalized,
    isJustified: matches.length > 0,
    matches,
    primary: matches[0] ?? null,
    processedLabel: matches.length
      ? matches.map((match) => match.label).join('; ')
      : 'Observacion no clasificada',
  };
}
