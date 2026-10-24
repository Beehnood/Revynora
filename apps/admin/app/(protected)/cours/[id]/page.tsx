import { CatalogDetail } from "@/modules/catalog/catalog-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatalogDetail id={id} />;
}
