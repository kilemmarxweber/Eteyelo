import TeacherAttendanceForm from "../component/TeacherAttendanceForm";

export default function Page() {
  return (
    <div className="p-6">
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
