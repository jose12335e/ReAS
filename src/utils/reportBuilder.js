function formatAuditMinutes(value) {
  const total = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function pickEmployeeExportRow(row) {
  const isAggregateRow =
    !row.codigo && /^(TOTAL|SUBTOTAL)/i.test(String(row.nombre ?? '').trim());
  const categoryValue = (value) => (isAggregateRow ? '' : value);

  return {
    NOMBRE: row.nombre,
    CODIGO: row.codigo,
    UBICACION: row.ubicacion,
    DEPARTAMENTO: row.departamento,
    CEDULA: row.cedula,
    CARGO: row.cargo,
    POSICION: row.posicion,
    'Fecha ingreso': row.fechaIngreso,
    'Tipo horario': row.tipoHorario,
    'Días laborables': row.diasLaborables,
    'Días a trabajar': row.diasATrabajar,
    'Días trabajados': row.diasTrabajadosCompletos,
    Vacaciones: row.vacaciones,
    Licencias: row.licencias,
    Permisos: row.permisos,
    'Ausencias justificadas': row.ausenciasJustificadas,
    'Ausencias no justificadas': row.ausenciasNoJustificadas,
    'Tardanzas justificadas': row.tardanzasJustificadas,
    'Tardanzas no justificadas': row.tardanzasNoJustificadas,
    'Categoría disciplinaria tardanzas': categoryValue(row.categoriaDisciplinariaTardanzas),
    'Color tardanzas': categoryValue(row.colorDisciplinarioTardanzas),
    'Salidas tempranas justificadas': row.salidasTempranasJustificadas,
    'Salidas tempranas no justificadas': row.salidasTempranasNoJustificadas,
    'Categoría disciplinaria salidas tempranas': categoryValue(
      row.categoriaDisciplinariaSalidasTempranas,
    ),
    'Color salidas tempranas': categoryValue(row.colorDisciplinarioSalidasTempranas),
    'Ponches irregulares': row.ponchesIrregulares,
    'Categoría disciplinaria ausencias': categoryValue(row.categoriaDisciplinariaAusencias),
    'Color ausencias': categoryValue(row.colorDisciplinarioAusencias),
    'Máx. ausencias no justificadas consecutivas': categoryValue(
      row.maxAusenciasNoJustificadasConsecutivas,
    ),
    'Horas esperadas': row.horasEsperadas,
    'Horas trabajadas reales': row.horasTrabajadasReales,
    'Horas trabajadas reconocidas': row.horasTrabajadasReconocidas,
    'Tiempo tardanza': row.tiempoTardanza,
    'Tiempo salida temprana': row.tiempoSalidaTemprana,
    'Tiempo no trabajado justificado': row.tiempoNoTrabajadoJustificado,
    'Tiempo no trabajado no justificado': row.tiempoNoTrabajadoNoJustificado,
    'Ajuste de cuadre': row.ajusteCuadre,
    'Tasa ausentismo': row.tasaAusentismo,
    'Ver viático': row.verViatico,
    'Observación procesada': row.observacionProcesada,
    'Estado final': row.estadoFinal,
  };
}

function pickAuditRow(row) {
  return {
    CODIGO: row.codigo,
    NOMBRE: row.nombre,
    UBICACION: row.ubicacion,
    'Tipo horario': row.tipoHorario,
    'Horas esperadas': row.horasEsperadas,
    'Horas reconocidas': row.horasReconocidas,
    'Tiempo no trabajado justificado': row.tiempoNoTrabajadoJustificado,
    'Tiempo no trabajado no justificado': row.tiempoNoTrabajadoNoJustificado,
    'Total calculado': row.totalCalculado,
    Diferencia: row.diferencia,
    'Estado de cuadre': row.estadoCuadre,
    'Posible causa': row.posibleCausa,
  };
}

function pickEventualityAuditRow(row) {
  return {
    PRIORIDAD: row.priority,
    ESTADO: row.status,
    RESUELTO: row.resolved ? 'SI' : 'NO',
    CODIGO: row.codigo,
    NOMBRE: row.nombre,
    UBICACION: row.ubicacion,
    FECHA: row.fecha,
    'EVENTUALIDAD EN ARCHIVO': row.tipoExternoLabel,
    'EVENTUALIDAD EN ASISTENCIA': row.tiposAsistenciaLabel,
    'CANTIDAD DIAS': row.cantidadDias,
    'CANTIDAD HORAS': row.cantidadHoras,
    'ESTADO EVENTUALIDAD': row.estadoEventualidadOriginal,
    RECOMENDACION:
      row.recomendacion === 'justified'
        ? 'Justificado'
        : row.recomendacion === 'unjustified'
          ? 'No justificado'
          : 'Revisión manual',
    COMENTARIO: row.comentario,
    'CLASIFICACION ACTUAL': row.clasificacionActual,
    'TIEMPO SUGERIDO': formatAuditMinutes(row.tiempoSugeridoMin),
    DECISION: row.decision,
    'TIEMPO APLICADO': row.appliedMinutes == null ? '' : formatAuditMinutes(row.appliedMinutes),
    'FILA ASISTENCIA': row.filaAsistencia,
    'HOJA EVENTUALIDADES': row.hoja,
    'FILA EVENTUALIDADES': row.filaEventualidades,
    HALLAZGO: row.reason,
    RESOLUCION: row.resolution,
  };
}

function pickLocationRow(row) {
  return {
    UBICACION: row.ubicacion,
    'Días laborables': row.diasLaborables,
    'Días a trabajar': row.diasATrabajar,
    'Días trabajados': row.diasTrabajadosCompletos,
    Vacaciones: row.vacaciones,
    Licencias: row.licencias,
    Permisos: row.permisos,
    'Ausencias justificadas': row.ausenciasJustificadas,
    'Ausencias no justificadas': row.ausenciasNoJustificadas,
    'Tardanzas justificadas': row.tardanzasJustificadas,
    'Tardanzas no justificadas': row.tardanzasNoJustificadas,
    'Salidas tempranas justificadas': row.salidasTempranasJustificadas,
    'Salidas tempranas no justificadas': row.salidasTempranasNoJustificadas,
    'Ponches irregulares': row.ponchesIrregulares,
    'Horas esperadas': row.horasEsperadas,
    'Horas reconocidas': row.horasReconocidas,
    'Tiempo tardanza': row.tiempoTardanza,
    'Tiempo salida temprana': row.tiempoSalidaTemprana,
    'Tiempo no trabajado justificado': row.tiempoNoTrabajadoJustificado,
    'Tiempo no trabajado no justificado': row.tiempoNoTrabajadoNoJustificado,
    'Tasa ausentismo': row.tasaAusentismo,
  };
}

function pickGeneralRow(row) {
  return {
    Alcance: row.alcance ?? 'Total general',
    'Días laborables': row.diasLaborables,
    'Días a trabajar': row.diasATrabajar,
    'Días trabajados': row.diasTrabajadosCompletos,
    Vacaciones: row.vacaciones,
    Licencias: row.licencias,
    Permisos: row.permisos,
    'Ausencias justificadas': row.ausenciasJustificadas,
    'Ausencias no justificadas': row.ausenciasNoJustificadas,
    'Tardanzas justificadas': row.tardanzasJustificadas,
    'Tardanzas no justificadas': row.tardanzasNoJustificadas,
    'Salidas tempranas justificadas': row.salidasTempranasJustificadas,
    'Salidas tempranas no justificadas': row.salidasTempranasNoJustificadas,
    'Ponches irregulares': row.ponchesIrregulares,
    'Horas esperadas': row.horasEsperadas,
    'Horas reconocidas': row.horasReconocidas,
    'Tiempo no trabajado justificado': row.tiempoNoTrabajadoJustificado,
    'Tiempo no trabajado no justificado': row.tiempoNoTrabajadoNoJustificado,
    'Tasa ausentismo': row.tasaAusentismo,
    'Ver viático': row.verViatico,
  };
}

export function buildReportWorkbookData(result) {
  const totalRow = pickLocationRow({
    ...result.summaryGeneral,
    ubicacion: 'TOTAL GENERAL',
  });

  const employeeRows = result.summaryByEmployee.map(pickEmployeeExportRow);
  const employeeRowsWithSubtotals = [
    pickEmployeeExportRow({
      ...result.summaryGeneral,
      nombre: 'TOTAL GENERAL',
      codigo: '',
      ubicacion: '',
      tipoHorario: '',
    }),
  ];

  result.summaryByLocation.forEach((location) => {
    employeeRowsWithSubtotals.push(
      pickEmployeeExportRow({
        ...location,
        nombre: `SUBTOTAL ${location.ubicacion}`,
        codigo: '',
        ubicacion: location.ubicacion,
        tipoHorario: '',
      }),
    );
    result.summaryByEmployee
      .filter((employee) => employee.ubicacion === location.ubicacion)
      .forEach((employee) => employeeRowsWithSubtotals.push(pickEmployeeExportRow(employee)));
  });

  const locationRows = [...result.summaryByLocation.map(pickLocationRow), totalRow];

  return {
    sheets: [
      { name: 'Data procesada', rows: result.processedRows },
      { name: 'Auditoria de cuadre', rows: (result.audit?.employeeAudits ?? []).map(pickAuditRow) },
      {
        name: 'Auditoria eventualidades',
        rows: (result.audit?.eventuality?.items ?? []).map(pickEventualityAuditRow),
      },
      { name: 'Resumen general', rows: [pickGeneralRow(result.summaryGeneral)] },
      { name: 'Resumen por ubicación', rows: locationRows },
      { name: 'Resumen por empleado', rows: employeeRowsWithSubtotals.length ? employeeRowsWithSubtotals : employeeRows },
      { name: 'Tardanzas', rows: result.events.tardanzas },
      { name: 'Salidas tempranas', rows: result.events.salidasTempranas },
      { name: 'Ausencias', rows: result.events.ausencias },
      { name: 'Vacaciones', rows: result.events.vacaciones },
      { name: 'Ponches irregulares', rows: result.events.ponchesIrregulares },
      { name: 'Eventualidades justificadas', rows: result.events.eventualidadesJustificadas },
    ],
  };
}
