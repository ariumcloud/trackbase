import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 21600 } });
    if (!response.ok) throw new Error("rate unavailable");
    const data = await response.json();
    if (data.result !== "success" || !data.rates) throw new Error("rate unavailable");
    const currencies = ["ARS", "BRL", "COP", "EUR", "MXN"];
    const rates = Object.fromEntries(
      currencies
        .map((currency) => [currency, Number(data.rates[currency])] as const)
        .filter(([, rate]) => Number.isFinite(rate) && rate > 0),
    );
    return NextResponse.json(
      { rates: { USD: 1, ...rates }, date: data.time_last_update_utc || null },
      { headers: { "Cache-Control": "public, max-age=21600" } },
    );
  } catch {
    return NextResponse.json({ error: "Câmbio indisponível no momento." }, { status: 503 });
  }
}
