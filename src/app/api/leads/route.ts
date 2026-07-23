import { NextResponse } from "next/server";
import { exigirSessaoApi } from "@/lib/auth/guards";
import { listarLeadsRepo } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

/** GET — banco de leads da empresa da sessão. O `orgId` vem da sessão, sempre. */
export async function GET() {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  return NextResponse.json({ leads: await listarLeadsRepo(g.user.orgId) });
}
