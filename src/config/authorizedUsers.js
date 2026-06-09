export const AUTHORIZED_UNIT = 'UNIDAD DE GESTION DE PROCESOS';

export const AUTHORIZED_USERS = [
  {
    code: '20210839',
    name: 'FRANK RAMIREZ PUJOLS',
    role: 'ENCARGADO',
    unit: AUTHORIZED_UNIT,
  },
  {
    code: '20220307',
    name: 'KEBIN JOSE PERALTA DUVAL',
    role: 'AUXILIAR',
    unit: AUTHORIZED_UNIT,
  },
  {
    code: '20221030',
    name: 'MIRANDA MEJIA RODRIGUEZ',
    role: 'ASISTENTE',
    unit: AUTHORIZED_UNIT,
  },
  {
    code: '20010090',
    name: 'NELAIDA MIGUELINA SANTANA PENA',
    role: 'ANALISTA DE GESTION HUMANA',
    unit: AUTHORIZED_UNIT,
  },
  {
    code: '20220270',
    name: 'JOSE MAGDIEL ARACENA DISHMEY',
    role: 'ANALISTA DE GESTION HUMANA',
    unit: AUTHORIZED_UNIT,
  },
];

export function normalizeEmployeeCode(value = '') {
  return String(value ?? '').trim().replace(/\D/g, '');
}

export function findAuthorizedUser(code) {
  const normalizedCode = normalizeEmployeeCode(code);
  return AUTHORIZED_USERS.find((user) => user.code === normalizedCode) ?? null;
}
