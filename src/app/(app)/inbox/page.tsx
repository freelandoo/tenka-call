import { exigirUsuario } from "@/lib/auth/guards";
import { listarConversasRepo } from "@/lib/repositories/conversas";
import { listarInstanciasRepo } from "@/lib/repositories/instancias";
import { InboxView } from "@/components/inbox/InboxView";

/** Inbox: ADMIN e ATENDENTE. A empresa vem da sessão, sempre. */
export default async function InboxPage() {
  const user = await exigirUsuario();
  const [conversas, instancias] = await Promise.all([
    listarConversasRepo(user.orgId),
    listarInstanciasRepo(user.orgId),
  ]);

  return (
    <InboxView
      inicial={conversas}
      instancias={instancias.map((i) => ({ id: i.id, nome: i.nome, status: i.status }))}
    />
  );
}
