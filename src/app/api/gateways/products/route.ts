import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, body, rateLimit, sameOrigin } from "@/lib/security";
import { GatewayCatalogError, listGatewayProducts } from "@/lib/gateway-catalog";

const schema = z.object({
  workspace: z.string().uuid(),
  provider: z.enum(["hotmart", "kiwify", "cakto"]),
  clientId: z.string().trim().min(3).max(300),
  clientSecret: z.string().trim().min(4).max(1000),
  accountId: z.string().trim().max(300).optional(),
  basicToken: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const value = schema.parse(await body(request));
    await authorize(value.workspace, true);
    if (!(await rateLimit(`gateway-products:${value.workspace}`, 10))) {
      return NextResponse.json({ error: "Aguarde um minuto antes de consultar novamente." }, { status: 429 });
    }
    const products = await listGatewayProducts(value.provider, value);
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof GatewayCatalogError ? error.message : "Não foi possível buscar os produtos. Confira as credenciais e permissões.",
    }, { status: 400 });
  }
}
