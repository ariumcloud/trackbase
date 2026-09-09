import { body, rateLimit } from "@/lib/security";
import { admin } from "@/lib/supabase/server";
import {
  captureSchema,
  filtersSchema,
  workspaceSchema,
} from "@/lib/mining/schema";
import { access, fail, result, MiningError } from "@/lib/mining/server";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const f = filtersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { client } = await access(request, f.workspace);
    let query = client
      .from("utm_mined_offers")
      .select("*", { count: "exact" })
      .eq("workspace_id", f.workspace);
    if (f.q) {
      const q = f.q.replace(/[^\p{L}\p{N}\s:/.@_-]/gu, " ").trim();
      if (q)
        query = query.or(
          `advertiser.ilike.%${q}%,niche.ilike.%${q}%,capture->>copy.ilike.%${q}%,capture->>landing_url.ilike.%${q}%`,
        );
    }
    if (f.format) query = query.eq("capture->>format", f.format);
    if (f.status) query = query.eq("status", f.status);
    if (f.tag) query = query.contains("tags", [f.tag]);
    if (f.min_days !== undefined) query = query.gte("days_active", f.min_days);
    if (f.max_days !== undefined) query = query.lte("days_active", f.max_days);
    query = query
      .order(
        f.sort === "days"
          ? "days_active"
          : f.sort === "advertiser"
            ? "advertiser"
            : "created_at",
        { ascending: f.sort === "advertiser", nullsFirst: false },
      )
      .order("id");
    const { data, error, count } = await query.range(
      f.page * 30,
      f.page * 30 + 29,
    );
    if (error) throw error;
    return result({ offers: data, count });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const p = z
      .object({
        workspace: workspaceSchema,
        capture: captureSchema,
        snapshot: z.boolean().default(false),
      })
      .strict()
      .parse(await body(request, 65536));
    const { user } = await access(request, p.workspace, true, true);
    if (!(await rateLimit(`mining:capture:${p.workspace}:${user.id}`, 60)))
      throw new MiningError("Muitas capturas. Tente em instantes.", 429);
    const { data, error } = await admin().rpc("utm_mining_capture", {
      p_workspace: p.workspace,
      p_capture: p.capture,
      p_snapshot: p.snapshot,
    });
    if (error?.message === "Monitoramento não ativo.")
      throw new MiningError(error.message, 409);
    if (error) throw error;
    return result(data, data.duplicate ? 200 : 201);
  } catch (e) {
    return fail(e);
  }
}
