import { notFound } from "next/navigation";
import { z } from "zod";
import { getAdminCustomer } from "@/lib/admin-data";
import { AdminCustomerView } from "@/components/admin/customer";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const data = await getAdminCustomer(id);
  if (!data) notFound();
  return <AdminCustomerView data={data} />;
}
