import { UserDetail } from "@/modules/admin/users/user-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetail key={id} id={id} />;
}
