import RoleDashboard from "@/components/RoleDashboard";

export default async function RoleDashboardPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;

  return <RoleDashboard roleParam={role} />;
}