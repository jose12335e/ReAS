import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 12;

export default function DataPreview({ rows, title = 'Vista previa', description }) {
  const [pageIndex, setPageIndex] = useState(0);
  const safeRows = rows ?? [];
  const columns = useMemo(() => {
    const headers = safeRows.length ? Object.keys(safeRows[0]) : [];
    return headers.map((header) => ({
      accessorKey: header,
      header,
      cell: (info) => String(info.getValue() ?? ''),
    }));
  }, [safeRows]);
  const pageCount = Math.max(1, Math.ceil(safeRows.length / PAGE_SIZE));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleRows = useMemo(
    () => safeRows.slice(currentPageIndex * PAGE_SIZE, currentPageIndex * PAGE_SIZE + PAGE_SIZE),
    [currentPageIndex, safeRows],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [rows]);

  const table = useReactTable({
    data: visibleRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!safeRows.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
              <Table2 className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
          {safeRows.length.toLocaleString('es-DO')} fila(s)
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 shadow-sm">
        <div className="max-h-[480px] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase text-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="whitespace-nowrap border-b border-slate-700 px-3 py-2.5 font-semibold">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/70">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="max-w-64 truncate border-b border-slate-100 px-3 py-2 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={currentPageIndex <= 0}
          onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="text-sm text-slate-600">
          Pagina {currentPageIndex + 1} de {pageCount}
        </span>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={currentPageIndex >= pageCount - 1}
          onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
