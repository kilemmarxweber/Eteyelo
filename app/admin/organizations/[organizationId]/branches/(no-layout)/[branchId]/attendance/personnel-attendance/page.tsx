import PersonnelAttendanceForm from "../component/PersonnelAttendanceForm";
import PersonnelAttendanceReport from "../component/PersonnelAttendanceReport";

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PersonnelAttendanceReport />
      <PersonnelAttendanceForm />
    </div>
  );
}
