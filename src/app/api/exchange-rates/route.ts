import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL,EUR,MXN,COP", { next: { revalidate: 21600 } });
    if (!response.ok) throw new Error("rate unavailable");
    const data = await response.json();
    return NextResponse.json({ rates: data.rates, date: data.date }, { headers: { "Cache-Control": "public, max-age=21600" } });
  } catch {
    return NextResponse.json({ error: "Câmbio indisponível no momento." }, { status: 503 });
  }
}
