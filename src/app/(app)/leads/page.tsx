import { exigirUsuario } from "@/lib/auth/guards";
import { listarLeadsRepo } from "@/lib/repositories/leads";
import { LeadsView } from "@/components/leads/LeadsView";

/** Banco de leads: ADMIN e ATENDENTE. A empresa vem da sessão, sempre. */
export default async function LeadsPage() {
  const user = await exigirUsuario();
  const leads = await listarLeadsRepo(user.orgId);

  return <LeadsView inicial={leads} />;
}
