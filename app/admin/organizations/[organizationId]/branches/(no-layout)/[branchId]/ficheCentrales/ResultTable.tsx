// "use client";

// import { Result } from "@/lib/types";
// import {
//   ColumnDef,
//   useReactTable,
//   getCoreRowModel,
//   flexRender,
// } from "@tanstack/react-table";
// import { Eye } from "lucide-react";
// import { FileText } from "lucide-react";
// import Link from "next/link";
// import { MessageSquare } from "lucide-react";

// export default function ResultTable({
//   data,
//   totalPercentage,
// }: {
//   data: Result[];
//   totalPercentage: string;
// }) {
//   // 🔹 Regrouper les données par subject
//   const subjectsData = data;

//   const columns = [
//     {
//       accessorKey: "name",
//       header: "Nom",
//       cell: ({ row }) => (
//         <span>
//           {row.original.TypeFiche ? (
//             // 👉 Si typeFiche existe → texte simple
//             <span className="text-blue-500 flex items-center gap-1">
//               {row.original.name}{" "}
//               <FileText size={16} className="text-red-500" />
//             </span>
//           ) : (
//             // 👉 Sinon → lien

//             <Link
//               href={`/admin/results/${encodeURIComponent(
//                 row.original.name,
//               )}?studentId=${row.original.id}&period=${row.original.periodName}`}
//               className="text-blue-600 hover:underline font-medium"
//             >
//               {row.original.name}
//             </Link>
//           )}
//         </span>
//       ),
//     },
//     { accessorKey: "date", header: "Échéance" },
//     {
//       accessorKey: "status",
//       header: "Statut",
//       cell: ({ row }) =>
//         row.original.status ? (
//           <span className="px-2 py-1 text-xs bg-blue-100 rounded-full">
//             {row.original.status}
//           </span>
//         ) : null,
//     },
//     {
//       accessorKey: "note",
//       header: "Note",
//       cell: ({ row }) => {
//         const note = row.original.note;
//         return (
//           <span
//             className={
//               note >= row.original.total / 2
//                 ? "text-green-600 font-medium"
//                 : "text-red-500 font-medium"
//             }
//           >
//             {note}
//           </span>
//         );
//       },
//     },
//     { accessorKey: "total", header: "Sur" },
//     {
//       accessorKey: "action",
//       header: "",
//       cell: ({ row }) => (
//         <span>
//           {row.original.TypeFiche ? (
//             // 👉 Si typeFiche existe → texte simple
//             <span className="text-blue-500 flex items-center gap-1">
//               {row.original.Comment}
//             </span>
//           ) : (
//             <div className="flex items-center gap-3 justify-end">
//               {/* Submit */}
//               <Eye
//                 size={16}
//                 className="text-blue-500 hover:text-blue-500 cursor-pointer"
//               />

//               {/* Feedback */}
//               <MessageSquare
//                 size={16}
//                 className="text-green-500 hover:text-green-500 cursor-pointer"
//               />
//             </div>
//           )}
//         </span>
//       ),
//     },
//   ] as ColumnDef<(typeof subjectsData)[0]>[];
//   const table = useReactTable({
//     data: subjectsData,
//     columns,
//     getCoreRowModel: getCoreRowModel(),
//   });

//   const totalScore = data.reduce((a, b) => a + b.note, 0);
//   const maxscore = data[0]?.Maxscore ?? 0;
//   const totalMax = data.reduce((a, b) => a + b.total, 0);
//   totalPercentage =
//     totalMax > 0
//       ? data[0]?.TypeFiche
//         ? ((((totalScore / totalMax) * maxscore) / maxscore) * 100).toFixed(1) // sur 50
//         : ((totalScore / totalMax) * 100).toFixed(1) // %
//       : "0.0";
//   const groupedByType = data.reduce(
//     (acc, item) => {
//       const key = `${item.TypeFiche}`; // status = periodeName
//       if (!acc[key]) {
//         acc[key] = {
//           totalNote: 0,
//           totalMax: 0,
//         };
//       }

//       acc[key].totalNote += item.note;
//       acc[key].totalMax += item.total;

//       return acc;
//     },
//     {} as Record<string, { totalNote: number; totalMax: number }>,
//   );
//   return (
//     <>
//       {/* TABLE */}
//       <table className="w-full text-sm text-left mb-4">
//         <thead></thead>

//         <tbody></tbody>
//         <tfoot className="text-sm">
//           {["Travaux Pratiques", "Exercices", "evaluations"].map((label, i) => {
//             const group = groupedByType[label];

//             const totalNote = group?.totalNote ?? 0;
//             const totalMax = group?.totalMax ?? 0;

//             const percentage =
//               totalMax > 0 ? ((totalNote / totalMax) * 100).toFixed(2) : "0.00";

//             return (
//               <tr key={i} className="border-b last:border-none">
//                 <td className="py-2 font-medium text-gray-700">{label}</td>
//                 <td />
//                 <td />
//                 <td className="text-right font-medium text-gray-800">
//                   {totalMax > 0 ? `${percentage}%` : "NA"}
//                 </td>
//                 <td className="text-right text-gray-500">
//                   {totalMax > 0
//                     ? `${totalNote.toFixed(2)} / ${totalMax.toFixed(2)}`
//                     : "0,00 / 0,00"}
//                 </td>
//               </tr>
//             );
//           })}

//           {/* TOTAL */}
//           <tr className="border-t-2 font-semibold text-base">
//             <td className="py-3">Total</td>
//             <td />
//             <td />
//             <td
//               className={`text-right ${
//                 Number(totalPercentage) < 50 ? "text-red-500" : "text-gray-800"
//               }`}
//             >
//               {totalPercentage}%
//             </td>
//             <td className="text-right">
//               {data[0]?.TypeFiche ? (
//                 <>
//                   <span
//                     className={
//                       (totalScore / totalMax) * maxscore < maxscore / 2
//                         ? "text-red-500 font-semibold"
//                         : "text-green-600 font-semibold"
//                     }
//                   >
//                     {((totalScore / totalMax) * maxscore).toFixed(2)}
//                   </span>{" "}
//                   / {maxscore}
//                 </>
//               ) : (
//                 <>
//                   <span
//                     className={
//                       totalScore < totalMax / 2
//                         ? "text-red-500 font-semibold"
//                         : "text-green-600 font-semibold"
//                     }
//                   >
//                     {totalScore.toFixed(1)}
//                   </span>{" "}
//                   / {totalMax.toFixed(0)}
//                 </>
//               )}
//             </td>
//           </tr>
//         </tfoot>
//       </table>
//     </>
//   );
// }
