import TeacherAttendanceForm from "../component/TeacherAttendanceForm";
import TeacherAttendanceReport from "../component/TeacherAttendanceReport";

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <TeacherAttendanceReport />
      <TeacherAttendanceForm
        onSuccess={() => {}}
        sessionData={{
          teacherId: "",
          teachingId: "",
          cours: "",
          classe: "",
          branch: {
            id: "",
            name: "",
          },
        }}
      />
    </div>
  );
}
