import { NextResponse } from "next/server";

// Health check público e leve — usado pelo smoke-test da pipeline de produção
// para validar que a aplicação publicada está no ar. Não consulta o banco nem
// expõe secrets; deve responder rapidamente. Ver docs/deployment/production-cicd.md.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
