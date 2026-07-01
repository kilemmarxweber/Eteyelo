import StudentEnrolledClient from "./components/StudentEnrolledClient";

export default async function Page({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = await params;

  return <StudentEnrolledClient classeId={classeId} />;
}
