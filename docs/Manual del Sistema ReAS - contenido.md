# Sistema ReAS

**Reportes de Asistencia**  
**Dirección de Gestión Humana**  
**Versión:** 1.0  
**Área responsable:** Unidad de Gestión de Procesos  
**Fecha:** Junio 2026

> Sistema ReAS: herramienta para el procesamiento, validación y generación de reportes institucionales de asistencia.

## 1. Introducción

El Sistema ReAS es una herramienta web desarrollada para apoyar el procesamiento de asistencia de empleados a partir de archivos Excel. Su propósito es automatizar tareas repetitivas, aplicar reglas institucionales de cálculo y generar reportes con una estructura uniforme, revisable y trazable.

ReAS permite trabajar con archivos de asistencia de gran volumen, incluyendo reportes con miles de registros. El sistema separa la interfaz del procesamiento pesado mediante Web Workers, lo que permite analizar la información sin congelar la pantalla del usuario.

El resultado final es un Excel institucional con hojas de control, tablas oficiales, resúmenes, auditoría de descuadres y detalle de eventualidades.

## 2. Justificación del sistema

Antes de ReAS, el proceso de revisión de asistencia dependía de tareas manuales en Excel: filtrar registros, calcular tiempos, contar eventualidades, validar observaciones y armar tablas para presentación. Este flujo podía consumir tiempo significativo y generar diferencias entre usuarios por cambios en fórmulas, criterios de revisión o errores de copia.

ReAS se desarrolló para reducir esa carga operativa y ofrecer una forma más estable de procesar la información. El sistema estandariza las reglas, automatiza cálculos, genera alertas de descuadre y conserva trazabilidad sobre los archivos usados, el mes evaluado y el usuario que generó el reporte.

### Beneficios principales

- Reduce trabajo manual repetitivo.
- Disminuye errores por fórmulas, filtros o copiado de datos.
- Estandariza reportes institucionales.
- Permite revisar descuadres por empleado.
- Facilita la identificación de casos con más ausencias, tardanzas o salidas tempranas.
- Conserva trazabilidad del reporte generado.

## 3. Proceso antes de ReAS

El proceso anterior se realizaba principalmente en Excel. De forma general, implicaba recibir el archivo de asistencia, revisar columnas, filtrar por empleado o ubicación, calcular ausencias, tardanzas y salidas tempranas, separar casos justificados y no justificados, validar descuadres y construir manualmente las tablas finales.

Este proceso requería atención constante, especialmente cuando el archivo contenía miles de filas, múltiples ubicaciones o empleados con condiciones especiales de horario.

### Riesgos del proceso manual

- Cálculos inconsistentes entre reportes.
- Omisión de empleados o registros.
- Errores al copiar datos entre hojas.
- Dificultad para detectar descuadres.
- Mayor tiempo de preparación.
- Menor trazabilidad sobre cambios realizados.

## 4. Proceso con ReAS

Con ReAS, el usuario carga los archivos, selecciona el mes, revisa el mapeo de columnas y ejecuta el procesamiento. El sistema aplica reglas, cruza información auxiliar, genera resúmenes y produce el Excel final.

### Flujo automatizado

1. El usuario inicia sesión con un código autorizado.
2. Carga el Excel principal de asistencia.
3. Carga archivos auxiliares si aplican: horario extendido y nómina.
4. Selecciona el mes evaluado cuando el archivo contiene varios meses.
5. Revisa o ajusta el mapeo de columnas.
6. Procesa la información.
7. Revisa el dashboard, rankings, resultados y auditoría.
8. Realiza ajustes manuales cuando existan descuadres.
9. Descarga el Excel final.
10. Valida la hoja de control y las tablas institucionales generadas.

## 5. Archivos que usa el sistema

### Excel principal de asistencia

Es el archivo base para calcular asistencia. Contiene la información de entrada, salida, fecha, observaciones y datos de identificación del empleado.

Columnas esperadas:

- Nombre.
- Ubicación.
- Código.
- Fecha.
- Día.
- Hora de entrada.
- Hora de salida.
- Observaciones.
- Tiempo de observaciones, opcional.

### Excel de horario extendido

Es un archivo auxiliar opcional. Se usa para identificar empleados que pertenecen al horario extendido. El cruce se realiza por código de empleado.

Si el libro tiene varias hojas, ReAS detecta el mes evaluado y usa la hoja correspondiente cuando es posible.

### Excel de nómina

Es un archivo auxiliar opcional. Se usa para completar datos del empleado y excluir registros que no deben calcularse.

Puede aportar:

- Código.
- Nombre.
- Cédula.
- Cargo.
- Ubicación.
- Fecha de ingreso.
- Posición.

Reglas de exclusión por nómina:

- Directores.
- Subdirectores.
- Personas con posición `DIRECCION V`.
- Personas con fecha de ingreso posterior al período evaluado.

## 6. Tipos de horario

### Horario normal

- Aplica de lunes a viernes.
- Cada día equivale a 8 horas.
- Entrada base: 08:00.
- Salida base: 16:00.

### Horario extendido

- Lunes a viernes: 11 horas.
- Sábado: 4 horas.
- Domingo: 0 horas.
- El cruce del personal de horario extendido se realiza por código de empleado.

### Horario modificado

Permite configurar días laborables, hora de entrada y hora de salida desde la interfaz. Se usa para casos en los que el horario normal o extendido no representa el período evaluado.

## 7. Reglas de observaciones

ReAS analiza la columna de observaciones sin distinguir entre mayúsculas y minúsculas. También normaliza acentos para detectar palabras clave de forma más estable.

| Observación detectada | Tratamiento |
|---|---|
| Vacaciones | Se registra en tabla de vacaciones y se descuenta según la regla vigente. |
| Licencia | Se registra como eventualidad justificada y tiempo no trabajado justificado. |
| Permiso | Se registra como eventualidad justificada y puede usar tiempo de observaciones. |
| Ausencia | Se registra como ausencia justificada. |
| Tardanza | Justifica una tardanza cuando la observación corresponde a tardanza. |
| Ver viático | Cuenta como día trabajado completo y no genera ausencia, tardanza ni salida temprana. |
| Feriado | Excluye el día del cálculo; no cuenta como día a trabajar. |

Las vacaciones no forman parte de las eventualidades justificadas. Se presentan en una tabla separada.

## 8. Reglas principales de cálculo

### Días a trabajar

Los días a trabajar se calculan considerando los días laborables del período, las vacaciones, los ponches irregulares, feriados y reglas del horario.

Las licencias cuentan como días a trabajar, pero representan tiempo no trabajado justificado.

### Horas a trabajar

Las horas a trabajar dependen del tipo de horario:

- HN: 8 horas por día.
- HE: 11 horas lunes a viernes y 4 horas sábado.
- Horario modificado: según los días y horas configurados.

### Horas trabajadas reales

Son la diferencia entre hora de entrada y hora de salida.

### Horas reconocidas

Son las horas válidas para el reporte. Las horas extra no se registran como tiempo adicional reconocido.

### Tiempo no trabajado justificado

Incluye licencias, permisos, ausencias justificadas y otros tiempos reconocidos por observaciones válidas.

### Tiempo no trabajado no justificado

Incluye tardanzas no justificadas, salidas tempranas no justificadas y ausencias no justificadas.

### Cuadre de horas

El sistema compara horas a trabajar, horas reconocidas, tiempo no trabajado justificado y tiempo no trabajado no justificado. Cuando la suma no coincide, se genera una alerta de auditoría para revisión.

## 9. Reglas disciplinarias

Las reglas disciplinarias no aplican sanciones automáticas. Solo sirven como referencia visual para evaluación humana.

### Ausencias no justificadas

| Cantidad | Color | Clasificación |
|---|---|---|
| 0 | Verde | Sin falta |
| 1 | Amarillo | Falta de 1er grado |
| 2 | Naranja | Falta de 2do grado |
| 3 o más | Rojo | Falta de 3er grado |

### Tardanzas y salidas tempranas

| Tiempo acumulado | Color | Clasificación |
|---|---|---|
| 00:00:00 a 02:00:00 | Verde | Sin falta |
| 02:01:00 a 05:00:00 | Amarillo | Falta de 1er grado |
| 05:01:00 a 07:00:00 | Naranja | Falta de 2do grado |
| 07:01:00 en adelante | Rojo | Falta de 3er grado |

## 10. Dashboard

El dashboard ofrece una vista general del resultado procesado. Incluye indicadores, gráficos, rankings y cuadros listos para copiar en reportes o comunicaciones.

Indicadores principales:

- Empleados analizados.
- Registros procesados.
- Ausencias.
- Tardanzas.
- Salidas tempranas.
- Ponches irregulares.
- Horas no trabajadas.
- Tasa de ausentismo.

También muestra rankings por colaborador para identificar personas con mayor cantidad de ausencias, tardanzas, salidas tempranas y mayor tiempo acumulado.

## 11. Auditoría de descuadres

La auditoría permite identificar empleados cuyo tiempo no cuadra. El sistema muestra el empleado, código, ubicación, horas esperadas, horas reconocidas, tiempo explicado, diferencia y registros asociados al descuadre.

Acciones disponibles:

- Sumar a justificado.
- Sumar a no justificado.
- Reducir justificado.
- Reducir no justificado.
- Agregar ponchado irregular.
- Revisar registros específicos.

La auditoría busca que el usuario pueda detectar el origen del descuadre antes de entregar el reporte final.

## 12. Excel final generado

El archivo exportado conserva una estructura institucional. Las primeras hojas son las tablas principales y luego se colocan datos, auditoría y resúmenes.

Orden de hojas:

1. Control del reporte.
2. Tabla 1 Vacaciones.
3. Tabla 2 Ponchado irregular.
4. Tabla 3-5 Reglas.
5. Tabla 6 Horas y días.
6. Tabla 7 Eventualidades.
7. Tabla 8 Eventualidades HE.
8. Data procesada.
9. Auditoría de cuadre.
10. Resumen general.
11. Resumen por ubicación.
12. Resumen por empleado.
13. Tardanzas.
14. Salidas tempranas.
15. Ausencias.
16. Vacaciones.
17. Ponches irregulares.
18. Eventualidades justificadas.

## 13. Protección del Excel

La hoja `Control del reporte` queda protegida y no se puede editar. Las demás hojas son editables para permitir ajustes, revisión y uso normal de las herramientas de Excel.

El libro protege su estructura para evitar mover, ocultar o borrar hojas. Esto mantiene la trazabilidad sin impedir que el usuario trabaje con las tablas.

## 14. Control del reporte

La hoja `Control del reporte` funciona como evidencia del procesamiento realizado.

Incluye:

- Sistema.
- Fecha y hora de generación.
- Código DGH.
- Mes evaluado.
- Archivo original.
- Hoja usada.
- Meses detectados.
- Usuario que generó el reporte.
- Nómina utilizada.
- Horario extendido utilizado.
- Exclusiones por nómina.
- Exclusiones por directores, subdirectores o `DIRECCION V`.
- Advertencias del procesamiento.

## 15. Seguridad y privacidad

El acceso al sistema se realiza mediante código de empleado autorizado. Esta validación funciona como barrera operativa local. No sustituye una autenticación de servidor.

El procesamiento ocurre en el navegador. El sistema puede usar almacenamiento local para conservar información de trabajo y evitar recargar archivos constantemente.

Los archivos de asistencia y nómina contienen información sensible. Deben manejarse únicamente por canales internos autorizados.

## 16. Arquitectura breve

ReAS está construido con tecnologías web modernas:

| Componente | Tecnología |
|---|---|
| Interfaz | React + Vite |
| Estilos | Tailwind CSS |
| Lectura Excel | SheetJS |
| Exportación Excel | ExcelJS |
| Procesamiento pesado | Web Workers |
| Tablas | TanStack Table |
| Gráficos | Recharts |
| Estado | Zustand |
| Persistencia | localStorage y sessionStorage |

Flujo general:

`Usuario → Interfaz → Web Worker → Reglas → Auditoría → Reportes → Excel final`

## 17. Preguntas frecuentes

### ¿Qué pasa si falta una columna?

El sistema muestra una validación para que el usuario revise el mapeo antes de procesar.

### ¿Qué pasa si el Excel tiene varios meses?

ReAS detecta los meses disponibles y permite seleccionar el mes que se desea evaluar.

### ¿Qué pasa si no se carga nómina?

El sistema puede procesar la asistencia, pero no podrá completar datos ni excluir personas por reglas de nómina.

### ¿Qué pasa si no se carga horario extendido?

Los empleados se procesan con el horario base seleccionado o con horario modificado si se configuró.

### ¿Qué pasa si hay descuadres?

La auditoría muestra los empleados y registros relacionados para que el usuario revise y aplique ajustes cuando corresponda.

### ¿Puedo editar las tablas del Excel final?

Sí. Las tablas y resúmenes son editables. Solo la hoja `Control del reporte` queda bloqueada.

### ¿Puedo mover o borrar hojas?

No. La estructura del libro está protegida para evitar mover, ocultar o eliminar hojas.

### ¿Qué significa DIRECCION V?

Es un valor usado en nómina para identificar posiciones que deben excluirse del cálculo, como directores o subdirectores.

### ¿Qué pasa con feriados?

Cuando una observación contiene `feriado`, el día no se reconoce como día a trabajar y sus horas no cuentan.

### ¿Qué pasa con licencias?

Las licencias cuentan como días a trabajar, pero su tiempo se registra como no trabajado justificado.

### ¿Qué diferencia hay entre horas reales y horas reconocidas?

Las horas reales son la diferencia entre entrada y salida. Las horas reconocidas son las horas válidas para el reporte, sin registrar horas extra.

## 18. Glosario

| Término | Definición |
|---|---|
| HN | Horario normal. |
| HE | Horario extendido. |
| Horario modificado | Horario definido manualmente por el usuario. |
| Horas esperadas | Horas que la persona debía trabajar según su horario. |
| Horas reconocidas | Horas válidas para el reporte final. |
| Tiempo justificado | Tiempo no trabajado respaldado por observación válida. |
| Tiempo no justificado | Tiempo no trabajado sin justificación válida. |
| Ponchado irregular | Registro donde entrada y salida son iguales o requiere revisión. |
| Ver viático | Trabajo externo reconocido como día completo. |
| Feriado | Día excluido del cálculo de trabajo. |
| Descuadre | Diferencia entre horas esperadas, reconocidas y tiempos explicados. |
| Nómina | Archivo auxiliar para completar datos y aplicar exclusiones. |
| Control del reporte | Hoja protegida con trazabilidad del procesamiento. |

## 19. Espacios para capturas

> Insertar captura 1: pantalla de inicio de sesión.

> Insertar captura 2: carga de archivos.

> Insertar captura 3: selección de mes y mapeo de columnas.

> Insertar captura 4: dashboard de resultados.

> Insertar captura 5: auditoría de descuadres.

> Insertar captura 6: Excel final generado.

## 20. Checklist de entrega del reporte

- Confirmar que el archivo principal corresponde al período evaluado.
- Confirmar que el mes seleccionado es correcto.
- Confirmar que la nómina fue cargada cuando aplica.
- Confirmar que el horario extendido fue cargado cuando aplica.
- Revisar el mapeo de columnas.
- Procesar la información.
- Revisar dashboard y rankings.
- Revisar auditoría de descuadres.
- Aplicar ajustes necesarios.
- Descargar el Excel final.
- Validar la hoja `Control del reporte`.
- Validar tablas 1 a 8.
- Guardar y distribuir el reporte por el canal autorizado.

## 21. Ampliación operativa: preparación antes del procesamiento

Antes de usar ReAS, el usuario debe confirmar que los archivos pertenecen al mismo período y que tienen una estructura consistente. Esta revisión previa evita reprocesos y ayuda a que los resultados sean confiables desde la primera ejecución.

### Revisión del archivo principal

El archivo principal de asistencia debe contener los registros del período a evaluar. Es importante confirmar que las fechas correspondan al mes correcto y que los códigos de empleados estén completos.

Puntos de revisión:

- Confirmar que el archivo abre correctamente en Excel.
- Confirmar que contiene las columnas necesarias.
- Confirmar que las fechas pertenecen al mes que se va a evaluar.
- Confirmar que los códigos de empleados no están vacíos.
- Confirmar que las horas de entrada y salida están en formato reconocible.
- Confirmar que las observaciones están en la columna correcta.

### Revisión del archivo de horario extendido

El archivo de horario extendido debe usarse cuando existan colaboradores que no se calculan con horario normal. El cruce se realiza por código de empleado, por lo que el código debe coincidir con el código del archivo principal.

Si el archivo contiene varias hojas, ReAS intenta usar la hoja correspondiente al mes evaluado. Aun así, el usuario debe revisar que la hoja seleccionada represente el período correcto.

### Revisión del archivo de nómina

La nómina ayuda a completar datos y aplicar exclusiones. Este archivo es especialmente importante para identificar empleados que no deben calcularse por cargo, posición o fecha de ingreso.

La nómina debe revisarse cuando:

- Hay empleados con nombres incompletos o inconsistentes.
- Se requiere excluir directores o subdirectores.
- Se requiere excluir posiciones identificadas como `DIRECCION V`.
- Se necesita validar si un colaborador ingresó después del mes evaluado.

## 22. Ampliación operativa: carga, mapeo y validación

Después de cargar el archivo principal, ReAS muestra una vista previa para confirmar que la información fue leída correctamente. Esta etapa es crítica porque el sistema no debe procesar si las columnas están mal asignadas.

### Mapeo de columnas

El mapeo permite indicar al sistema qué columna representa cada dato. Aunque el archivo tenga encabezados diferentes, el usuario puede asociarlos manualmente.

Campos que deben revisarse con especial atención:

| Campo | Por qué es importante |
|---|---|
| Código | Es la llave para agrupar empleados y cruzar horario extendido y nómina. |
| Nombre | Permite presentar reportes legibles y evitar confusión en tablas. |
| Ubicación | Se usa para agrupar reportes por área o dependencia. |
| Fecha | Define el período evaluado y permite detectar meses. |
| Hora de entrada | Base para tardanzas y horas reales. |
| Hora de salida | Base para salidas tempranas y horas reales. |
| Observaciones | Define justificaciones, feriados, vacaciones, licencias, permisos y viáticos. |
| Tiempo de observaciones | Campo opcional para permisos u observaciones con tiempo específico. |

### Validaciones antes de procesar

ReAS debe impedir el procesamiento cuando falta información obligatoria. Si el sistema muestra un error, el usuario debe revisar el mapeo y confirmar que el archivo realmente contiene el dato requerido.

Errores comunes en esta etapa:

- La columna de código fue confundida con nombre.
- La columna de fecha no fue detectada correctamente.
- La hora de entrada o salida está en una columna diferente.
- La observación está vacía o en una columna auxiliar.
- El archivo contiene encabezados repetidos.

## 23. Ampliación de reglas: cómo interpreta ReAS cada caso

ReAS combina información de horario, entradas, salidas y observaciones. La interpretación final depende de la combinación de esos elementos.

### Día trabajado completo

Un día se considera trabajado cuando el empleado registra entrada y salida válidas y las horas reconocidas completan las horas esperadas del día. Si trabaja más del tiempo esperado, ReAS reconoce únicamente las horas esperadas. Las horas extra no se suman al reporte.

### Día trabajado con tardanza

Si la entrada es posterior a la hora esperada, se genera tardanza. La tardanza solo se considera justificada si la observación corresponde a una justificación válida de tardanza.

Regla importante:

Si la persona llegó tarde y la observación dice `permiso`, no se justifica automáticamente la tardanza. Para justificar tardanza, la observación debe indicar tardanza.

### Día trabajado con salida temprana

Si la salida es anterior a la hora esperada, se genera salida temprana. La salida temprana se clasifica como justificada o no justificada según la observación válida asociada.

### Ausencia

Cuando entrada y salida están vacías, el sistema revisa la observación. Si no existe observación válida, se registra ausencia no justificada. Si existe licencia, permiso, ausencia justificada u otra observación reconocida, se clasifica como tiempo no trabajado justificado.

### Licencia

La licencia cuenta como día a trabajar, pero su tiempo se registra como no trabajado justificado. No debe marcarse como ausencia no justificada, tardanza ni salida temprana.

Ejemplo:

- Empleado HN con licencia en un día laborable.
- Horas a trabajar: 8.
- Horas reconocidas: 0.
- Tiempo no trabajado justificado: 8.
- Resultado: cuadrado si no hay otros tiempos pendientes.

### Permiso

El permiso se toma como tiempo no trabajado justificado. Si el archivo trae `Tiempo de observaciones`, el sistema usa ese tiempo cuando aplica. Si no existe ese tiempo, se aplican las reglas generales del día.

### Feriado

El feriado excluye el día del cálculo. No importa si hay ponche o no; el día no debe contar como día a trabajar y no debe generar horas esperadas.

### Ver viático

`Ver viático` representa trabajo externo. Cuando se detecta, el sistema reconoce el día como trabajado completo. No genera ausencia, tardanza, salida temprana ni tiempo no trabajado.

### Ponchado irregular

Un ponchado irregular ocurre cuando la entrada y la salida son iguales o cuando el registro requiere revisión por inconsistencia. No cuenta como día trabajado. Sin embargo, si el registro tiene observación válida como permiso, licencia o ausencia, el sistema debe tratarlo como eventualidad justificada cuando corresponda.

## 24. Ampliación de cuadre y auditoría

La auditoría de cuadre es una de las partes más importantes del sistema. Su objetivo es detectar diferencias entre lo que el empleado debía trabajar y lo que el sistema pudo explicar con horas reconocidas, tiempo justificado y tiempo no justificado.

### Fórmula conceptual

Para cada empleado, el sistema busca que se cumpla:

`Horas a trabajar = Horas reconocidas + Tiempo no trabajado justificado + Tiempo no trabajado no justificado`

Cuando esa relación no se cumple, se genera un descuadre.

### Descuadre positivo

Un descuadre positivo indica que falta tiempo por explicar. Puede ocurrir cuando hay registros sin observación, tiempos incompletos o casos que requieren revisión manual.

Acciones posibles:

- Revisar registros del empleado.
- Confirmar si hubo ausencia, permiso o licencia.
- Sumar el tiempo faltante a justificado o no justificado según corresponda.
- Corregir el archivo original si el error viene de la fuente.

### Descuadre negativo

Un descuadre negativo indica que el tiempo explicado excede las horas esperadas. Puede ocurrir cuando un permiso o una observación tiene más tiempo del que corresponde para ese día.

Acciones posibles:

- Reducir tiempo justificado.
- Reducir tiempo no justificado.
- Revisar si el día era feriado o no laborable.
- Validar si el tiempo de observación fue digitado incorrectamente.

### Revisión por registros asociados

Cuando el sistema muestra registros vinculados al descuadre, el usuario debe revisar cada registro antes de ajustar. La auditoría no debe resolverse sin entender el origen de la diferencia.

Datos que deben revisarse:

- Fecha.
- Día de la semana.
- Entrada.
- Salida.
- Observación.
- Tiempo de observación.
- Horas esperadas.
- Horas reconocidas.
- Tiempo justificado.
- Tiempo no justificado.
- Estado calculado.

## 25. Descripción detallada de las hojas del Excel final

El Excel final se organiza para que las hojas de presentación queden primero y las hojas de revisión queden después.

### Control del reporte

Es la hoja de trazabilidad. No se debe editar. Contiene datos del procesamiento, usuario, mes evaluado, archivo original, hoja usada, uso de nómina, uso de horario extendido y exclusiones aplicadas.

### Tabla 1 Vacaciones

Lista colaboradores con vacaciones registradas. Se ordena para facilitar la revisión de quienes tienen mayor cantidad.

### Tabla 2 Ponchado irregular

Lista colaboradores con ponches irregulares. Permite identificar registros que requieren revisión por entrada y salida iguales u otra condición irregular.

### Tabla 3-5 Reglas

Contiene las reglas de referencia disciplinaria para ausencias, tardanzas y salidas tempranas. Estas reglas no aplican sanciones automáticas.

### Tabla 6 Horas y días

Compara días a trabajar contra días trabajados, y horas a trabajar contra horas trabajadas. También muestra tasa de ausentismo.

### Tabla 7 Eventualidades

Consolida eventualidades justificadas y no justificadas para colaboradores de horario normal. Incluye colores disciplinarios para tardanzas, salidas tempranas y ausencias no justificadas.

### Tabla 8 Eventualidades HE

Tiene la misma finalidad que la Tabla 7, pero aplicada a personal con horario extendido.

### Data procesada

Contiene el detalle de registros procesados. Es útil para validar cómo se interpretó cada fila del archivo original.

### Auditoría de cuadre

Muestra empleados con diferencias entre horas a trabajar y tiempos explicados. Es la hoja de revisión para resolver descuadres.

### Resúmenes

Los resúmenes presentan la información consolidada a nivel general, por ubicación y por empleado.

## 26. Errores comunes y acciones recomendadas

| Situación | Posible causa | Acción recomendada |
|---|---|---|
| No se puede procesar | Falta columna obligatoria o mapeo incorrecto | Revisar mapeo y vista previa. |
| El nombre sale como código | Nombre vacío o cruce incompleto | Revisar columna de nombre y nómina. |
| Muchos registros salen en rojo | Acumulados no justificados altos | Revisar observaciones y justificaciones. |
| No detecta horario extendido | Código no coincide o archivo no cargado | Revisar archivo auxiliar y códigos. |
| No excluye directores | Nómina no cargada o posición no reconocida | Revisar columnas de cargo y posición. |
| Hay descuadre positivo | Falta tiempo por explicar | Revisar auditoría y registros del empleado. |
| Hay descuadre negativo | Tiempo explicado excede horas esperadas | Revisar permisos, licencias, feriados o tiempos digitados. |
| El mes no es correcto | Archivo contiene varios meses | Seleccionar el mes correcto antes de procesar. |

## 27. Roles y responsabilidades

### Usuario operador

Responsable de cargar archivos, validar mapeos, ejecutar procesamiento y revisar resultados iniciales.

### Revisor de Gestión Humana

Responsable de validar auditoría, confirmar ajustes, revisar casos críticos y aprobar el reporte final.

### Supervisor o responsable de área

Puede usar las tablas y rankings para identificar colaboradores que requieren revisión o seguimiento.

### Soporte técnico

Responsable de mantener el sistema, revisar errores técnicos y actualizar reglas cuando la institución lo requiera.

## 28. Preparación para presentar ReAS al equipo

La presentación debe enfocarse primero en el problema que ReAS resuelve y luego en la demostración del sistema. El equipo debe entender que ReAS no elimina la revisión humana; la hace más rápida, ordenada y trazable.

Orden recomendado:

1. Presentar el problema del proceso manual.
2. Explicar qué es ReAS.
3. Mostrar archivos de entrada.
4. Mostrar carga y selección de mes.
5. Mostrar procesamiento.
6. Mostrar dashboard y rankings.
7. Mostrar auditoría de descuadres.
8. Mostrar Excel final.
9. Explicar trazabilidad y protección.
10. Cerrar con beneficios y próximos pasos.

Mensajes clave:

- ReAS reduce trabajo manual repetitivo.
- ReAS ayuda a estandarizar criterios.
- ReAS mejora la trazabilidad del reporte.
- ReAS facilita detectar casos críticos.
- ReAS genera información para revisión humana, no sanciones automáticas.

## 29. Recomendaciones de uso responsable

- Verificar siempre el mes evaluado.
- No procesar archivos de períodos mezclados sin seleccionar el mes correcto.
- No entregar reportes con descuadres pendientes sin explicación.
- No compartir archivos con datos sensibles fuera de canales autorizados.
- Usar datos ficticios en capacitaciones o presentaciones abiertas.
- Validar exclusiones por nómina cuando se cargue el archivo auxiliar.
- Guardar evidencia del reporte final generado.
