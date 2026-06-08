import {
  FileDown,
  FileText,
  MapPinned,
  Printer,
  UserRound,
} from 'lucide-react';
import ExportButton from './ExportButton.jsx';
import SummaryCards from './SummaryCards.jsx';

function ReportAction({ icon: Icon, title, description, onClick, disabled }) {
  return (
    <button
      className="flex min-h-24 items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/70 transition hover:border-teal-200 hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-50"
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-950">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
      </span>
    </button>
  );
}

export default function ReportsPanel({ result, disabled, reportOptions, filename, hasPendingAudit }) {
  const canPrint = Boolean(result);
  const printReport = () => window.print();

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Reportes institucionales</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Exporta el Excel final o imprime vistas formales con encabezado, fecha, filtros y resumen.
            </p>
          </div>
          <ExportButton
            result={result}
            disabled={disabled || hasPendingAudit}
            reportOptions={reportOptions}
            filename={filename}
          />
        </div>
        {hasPendingAudit ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            El Excel final se habilita cuando todos los empleados y el total general estén cuadrados.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReportAction
          icon={FileDown}
          title="Exportar PDF"
          description="Abre el diálogo de impresión para guardar la vista como PDF."
          disabled={!canPrint}
          onClick={printReport}
        />
        <ReportAction
          icon={Printer}
          title="Imprimir resumen general"
          description="Imprime la pantalla actual con el resumen y los filtros aplicados."
          disabled={!canPrint}
          onClick={printReport}
        />
        <ReportAction
          icon={FileText}
          title="Imprimir cuadro de eventualidades"
          description="Usa los cuadros copiables y el resumen institucional del reporte."
          disabled={!canPrint}
          onClick={printReport}
        />
        <ReportAction
          icon={UserRound}
          title="Reporte por empleado"
          description="Consulta la pestaña Resultados y filtra por código o nombre antes de imprimir."
          disabled={!canPrint}
          onClick={printReport}
        />
        <ReportAction
          icon={MapPinned}
          title="Reporte por ubicación"
          description="Filtra por ubicación en Resultados y luego imprime o exporta."
          disabled={!canPrint}
          onClick={printReport}
        />
        <ReportAction
          icon={FileText}
          title="Reporte mensual"
          description="El mes seleccionado queda reflejado en el procesamiento y los reportes."
          disabled={!canPrint}
          onClick={printReport}
        />
      </div>

      <SummaryCards result={result} />
    </section>
  );
}
