"use client";
"use strict";
exports.__esModule = true;
exports.DataTable = void 0;
var React = require("react");
var react_table_1 = require("@tanstack/react-table");
var table_1 = require("@/components/ui/table");
var data_table_pagination_1 = require("./data-table-pagination");
function DataTable(_a) {
    var _b;
    var columns = _a.columns, data = _a.data, emptyText = _a.emptyText, ToolbarComponent = _a.ToolbarComponent;
    var _c = React.useState({}), rowSelection = _c[0], setRowSelection = _c[1];
    var _d = React.useState({}), columnVisibility = _d[0], setColumnVisibility = _d[1];
    var _e = React.useState([]), columnFilters = _e[0], setColumnFilters = _e[1];
    var _f = React.useState([]), sorting = _f[0], setSorting = _f[1];
    var table = react_table_1.useReactTable({
        data: data,
        columns: columns,
        state: {
            sorting: sorting,
            columnVisibility: columnVisibility,
            rowSelection: rowSelection,
            columnFilters: columnFilters
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: react_table_1.getCoreRowModel(),
        getFilteredRowModel: react_table_1.getFilteredRowModel(),
        getPaginationRowModel: react_table_1.getPaginationRowModel(),
        getSortedRowModel: react_table_1.getSortedRowModel(),
        getFacetedRowModel: react_table_1.getFacetedRowModel(),
        getFacetedUniqueValues: react_table_1.getFacetedUniqueValues()
    });
    return (React.createElement("div", { className: "space-y-4" },
        React.createElement(ToolbarComponent, { table: table }),
        React.createElement("div", { className: "rounded-md border" },
            React.createElement(table_1.Table, null,
                React.createElement(table_1.TableHeader, null, table.getHeaderGroups().map(function (headerGroup) { return (React.createElement(table_1.TableRow, { key: headerGroup.id }, headerGroup.headers.map(function (header) {
                    return (React.createElement(table_1.TableHead, { key: header.id, colSpan: header.colSpan }, header.isPlaceholder
                        ? null
                        : react_table_1.flexRender(header.column.columnDef.header, header.getContext())));
                }))); })),
                React.createElement(table_1.TableBody, null, ((_b = table.getRowModel().rows) === null || _b === void 0 ? void 0 : _b.length) ? (table.getRowModel().rows.map(function (row) { return (React.createElement(table_1.TableRow, { key: row.id, "data-state": row.getIsSelected() && "selected" }, row.getVisibleCells().map(function (cell) { return (React.createElement(table_1.TableCell, { key: cell.id }, react_table_1.flexRender(cell.column.columnDef.cell, cell.getContext()))); }))); })) : (React.createElement(table_1.TableRow, null,
                    React.createElement(table_1.TableCell, { colSpan: columns.length, className: "h-24 text-center" }, emptyText)))))),
        React.createElement(data_table_pagination_1.DataTablePagination, { table: table })));
}
exports.DataTable = DataTable;
