import { getAdminData } from "@/lib/admin-data";
import { adminPageNumber } from "@/lib/admin-validation";
import { AdminDashboard } from "@/components/admin/dashboard";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    tab?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 160);
  const page = adminPageNumber(params.page);
  const data = await getAdminData(search, page, params.status);
  return (
    <AdminDashboard
      data={data}
      search={search}
      page={page}
      tab={params.tab ?? "overview"}
    />
  );
}
