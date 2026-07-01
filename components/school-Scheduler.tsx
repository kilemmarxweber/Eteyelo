// "use client";

// import { useState, useEffect } from "react";
// import { GraduationCap, Clock } from "lucide-react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { getCalendarEvents } from "@/app/admin/CalendarEvent/CalendarEvent.acton";

// export default function SchoolScheduler() {
//   const [filter, setFilter] = useState("week");
//   const [courses, setCourses] = useState<any[]>([]); // State pour les cours récupérés

//   useEffect(() => {
//     const loadCourses = async () => {
//       try {
//         const events = await getCalendarEvents(); // Appel de la server action pour récupérer les cours
//         setCourses(events); // Met à jour l'état avec les données récupérées
//       } catch (error) {
//         console.error("Failed to fetch courses:", error);
//       }
//     };

//     loadCourses(); // Récupère les cours au montage du composant
//   }, []);

//   const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

//   const getTodayIndex = () => {
//     const today = new Date().getDay();
//     return today === 0 || today === 6 ? 0 : today - 1;
//   };

//   const getFilteredDays = () => {
//     switch (filter) {
//       case "today":
//         return [daysOfWeek[getTodayIndex()]];
//       case "tomorrow":
//         const tomorrowIndex = (getTodayIndex() + 1) % 5;
//         return [daysOfWeek[tomorrowIndex]];
//       default:
//         return daysOfWeek;
//     }
//   };

//   const renderWeekView = () => (
//     <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
//       {daysOfWeek.map((day) => (
//         <div key={day} className="border rounded p-2">
//           <h3 className="font-semibold mb-2 text-center">{day}</h3>
//           {courses
//             .filter((course) => course.day === day)
//             .map((course) => (
//               <div
//                 key={course.id}
//                 className={`rounded p-1 mb-1 text-xs ${
//                   course.name === "Recreation"
//                     ? "bg-secondary/20"
//                     : "bg-primary/10"
//                 }`}
//               >
//                 <p className="font-medium">{course.name}</p>
//                 <p>{`${course.startTime} - ${course.endTime}`}</p>
//               </div>
//             ))}
//         </div>
//       ))}
//     </div>
//   );

//   const renderDayView = (day: string) => (
//     <div className="mt-4">
//       <h3 className="font-semibold text-xl mb-4 text-center">{day}</h3>
//       <div className="space-y-4">
//         {courses
//           .filter((course) => course.day === day)
//           .map((course) => (
//             <div
//               key={course.id}
//               className={`flex items-center space-x-4 p-3 rounded-lg ${
//                 course.name === "Recreation"
//                   ? "bg-secondary/20"
//                   : "bg-primary/10"
//               }`}
//             >
//               <div className="flex-shrink-0">
//                 <Clock className="h-6 w-6 text-primary" />
//               </div>
//               <div className="flex-grow">
//                 <p className="font-semibold text-lg">{course.name}</p>
//                 <p className="text-sm text-gray-600">{`${course.startTime} - ${course.endTime}`}</p>
//               </div>
//             </div>
//           ))}
//       </div>
//     </div>
//   );

//   const renderSchedule = () => {
//     const filteredDays = getFilteredDays();
//     if (filter === "week") {
//       return renderWeekView();
//     } else {
//       return renderDayView(filteredDays[0]);
//     }
//   };

//   return (
//     <Card className="w-full max-w-6xl mx-auto">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center">
//             <GraduationCap className="mr-2 h-6 w-6" />
//             School Schedule
//           </div>
//           <Select value={filter} onValueChange={setFilter}>
//             <SelectTrigger className="w-[180px]">
//               <SelectValue placeholder="Select view" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="week">Full Week</SelectItem>
//               <SelectItem value="today">Today</SelectItem>
//               <SelectItem value="tomorrow">Tomorrow</SelectItem>
//             </SelectContent>
//           </Select>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>{renderSchedule()}</CardContent>
//     </Card>
//   );
// }
