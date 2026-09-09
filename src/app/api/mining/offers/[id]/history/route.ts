import { fail, result, offerAccess } from "@/lib/mining/server";
import { z } from "zod";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { client, workspace, offer } = await offerAccess(
      request,
      (await context.params).id,
    );
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get("page") || 0);
    const results = await Promise.all(
      [
        "utm_mining_snapshots",
        "utm_mining_changes",
        "utm_mining_analyses",
        "utm_mining_runs",
      ].map((table) =>
        client
          .from(table)
          .select("*", { count: "exact" })
          .eq("workspace_id", workspace)
          .eq("offer_id", offer.id)
          .order(
            table === "utm_mining_snapshots" ? "captured_at" : "created_at",
            { ascending: false },
          )
          .range(page * 30, page * 30 + 29),
      ),
    );
    for (const r of results) if (r.error) throw r.error;
    return result({
      snapshots: results[0].data,
      changes: results[1].data,
      analyses: results[2].data,
      runs: results[3].data,
      count: Math.max(...results.map((r) => r.count || 0)),
    });
  } catch (e) {
    return fail(e);
  }
}
