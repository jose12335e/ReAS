import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useMemo } from 'react';

export default function DataPreview({ rows, title = 'Vista previa', description }) {
  const columns = useMemo(() => {
    const headers = rows?.length ? Object.keys(rows[0]) : [];
    return headers.map((header) => ({
      accessorKey: header,
      header,
      cell: (info) => String(info.getValue() ?? ''),
    }));
  }, [rows]);

  const table = useReactTable({
    data: rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 12 },
    },
  });

  if (!rows?.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        <span className="text-sm text-slate-500">{rows.length.toLocaleString()} fila(s)</span>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200">
        <div className="max-h-[480px] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50/60">
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
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="text-sm text-slate-600">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </span>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
