# Sistema ReAS

ReAS es una herramienta web para procesar reportes de asistencia desde archivos Excel, aplicar reglas institucionales, auditar descuadres y generar un Excel final con tablas, resúmenes y trazabilidad.

El sistema fue creado para reducir el trabajo manual en Excel, estandarizar cálculos de asistencia y facilitar la revisión de vacaciones, licencias, permisos, ausencias, tardanzas, salidas tempranas, ponches irregulares y horarios especiales.

## Características principales

- Lectura de archivo principal de asistencia en formato `.xlsx`, `.xls` o `.csv`.
- Mapeo de columnas antes de procesar.
- Detección y selección del mes evaluado.
- Cruce opcional con archivo de horario extendido.
- Cruce opcional con nómina para completar datos y excluir personal no calculable.
- Reglas para horario normal, horario extendido y horario modificado.
- Procesamiento pesado en Web Worker para evitar bloquear la interfaz.
- Dashboard con indicadores, gráficos, rankings y cuadros listos para copiar.
- Auditoría de descuadres por empleado y por registro.
- Exportación Excel institucional con hojas de control, tablas y resúmenes.
- Protección de estructura del libro exportado para evitar mover, ocultar o borrar hojas.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Estilos | Tailwind CSS |
| Lectura Excel | SheetJS `xlsx` |
| Exportación Excel | ExcelJS |
| Procesamiento pesado | Web Workers |
| Tablas | TanStack Table |
| Gráficos | Recharts |
| Estado global | Zustand |
| Persistencia local | localStorage / sessionStorage |

## Requisitos

- Node.js compatible con el proyecto.
- Navegador moderno.
- Archivos Excel con la estructura esperada.

## Instalación

```bash
npm install
```

## Ejecución local

```bash
npm run dev
```

Luego abre la URL indicada por Vite, normalmente:

```text
http://localhost:5173/
```

## Build de producción

```bash
npm run build
```

## Archivos de entrada

### Excel principal de asistencia

Archivo base usado para calcular asistencia.

Columnas esperadas:

- `NOMBRE`
- `UBICACION`
- `CODIGO`
- `FECHA`
- `DIA`
- `HORA DE ENTRADA`
- `HORA DE SALIDA`
- `OBSERVACIONES`
- `TIEMPO DE OBSERVACIONES` opcional

### Excel de horario extendido

Archivo opcional usado para identificar empleados con horario extendido. El cruce se realiza por código de empleado. Si el libro contiene varias hojas, el sistema puede seleccionar la hoja correspondiente al mes evaluado.

### Excel de nómina

Archivo opcional usado para completar datos del colaborador y excluir registros que no deben calcularse, por ejemplo directores, subdirectores, posiciones `DIRECCION V` o personas con fecha de ingreso posterior al mes evaluado.

## Flujo general de uso

1. Iniciar sesión con código autorizado.
2. Cargar el Excel principal de asistencia.
3. Cargar horario extendido y nómina si aplican.
4. Seleccionar el mes evaluado.
5. Revisar o ajustar el mapeo de columnas.
6. Procesar la información.
7. Revisar dashboard, resultados y auditoría.
8. Aplicar ajustes manuales si hay descuadres.
9. Descargar el Excel final.
10. Validar la hoja `Control del reporte` y las tablas generadas.

## Excel final generado

El archivo exportado incluye, entre otras, estas hojas:

1. `Control del reporte`
2. `Tabla 1 Vacaciones`
3. `Tabla 2 Ponchado irregular`
4. `Tabla 3-5 Reglas`
5. `Tabla 6 Horas y dias`
6. `Tabla 7 Eventualidades`
7. `Tabla 8 Eventualidades HE`
8. `Data procesada`
9. `Auditoria de cuadre`
10. `Resumen general`
11. `Resumen por ubicación`
12. `Resumen por empleado`

La hoja `Control del reporte` queda protegida y no editable. Las demás hojas son editables. La estructura del libro queda protegida para evitar mover, ocultar o borrar hojas.

## Documentación

La documentación de presentación y operación está en la carpeta `docs/`:

- `Manual del Sistema ReAS - contenido.md`
- `Manual del Sistema ReAS - Reportes de Asistencia.docx`
- `Manual del Sistema ReAS - Reportes de Asistencia.pdf`
- `Guion de presentacion ReAS.md`
- `Checklist de validacion ReAS.md`
- `build_reas_documentation.py`

Para regenerar el manual Word y PDF:

```bash
python docs/build_reas_documentation.py
```

## Seguridad y privacidad

ReAS procesa la información localmente en el navegador. El acceso por código de empleado funciona como barrera operativa local, no como autenticación de servidor. Los archivos de asistencia y nómina contienen datos sensibles y deben manejarse únicamente por los canales internos autorizados.

## Estado del proyecto

Versión base funcional para procesamiento, auditoría y exportación de reportes institucionales de asistencia.
