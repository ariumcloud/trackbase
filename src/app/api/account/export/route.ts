import { NextResponse } from "next/server";
import { admin, db } from "@/lib/supabase/server";

const exportTables = [
  "utm_offers",
  "utm_links",
  "utm_integrations",
  "utm_sales",
  "utm_insights",
  "utm_events",
  "utm_webhook_logs",
  "utm_capi_logs",
  "utm_alert_rules",
  "utm_alerts",
  "utm_funnels",
  "utm_funnel_diagnostics",
] as const;

async function readAll(table: (typeof exportTables)[number], workspaceIds: string[]) {
  const service = admin();
  const rows: unknown[] = [];
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await service
      .from(table)
      .select("*")
      .in("workspace_id", workspaceIds)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function GET() {
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const { data: memberships, error } = await client
      .from("utm_members")
      .select("workspace_id,role")
      .eq("user_id", user.id);
    if (error) throw error;
    const workspaceIds = (memberships ?? [])
      .filter((membership) => ["owner", "admin"].includes(membership.role))
      .map((membership) => membership.workspace_id);
    if ((memberships ?? []).length > 0 && workspaceIds.length === 0) {
      return NextResponse.json(
        { error: "Apenas proprietários e administradores podem exportar dados." },
        { status: 403 },
      );
    }
    const service = admin();
    const { data: workspaces, error: workspacesError } = workspaceIds.length
      ? await service.from("utm_workspaces").select("*").in("id", workspaceIds)
      : { data: [], error: null };
    if (workspacesError) throw workspacesError;

    const datasets = await Promise.all(
      exportTables.map(async (table) => [table, workspaceIds.length ? await readAll(table, workspaceIds) : []] as const),
    );

    return new NextResponse(
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email ?? null },
        workspaces: workspaces ?? [],
        data: Object.fromEntries(datasets),
        omitted: ["utm_credentials", "utm_push_subscriptions"],
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="trackbase-data-export.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível preparar a exportação." },
      { status: 503 },
    );
  }
}
