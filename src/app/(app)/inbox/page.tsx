import { exigirUsuario } from "@/lib/auth/guards";
import { podePapel, type Papel } from "@/lib/auth/papeis";
import { listarConversasRepo } from "@/lib/repositories/conversas";
import { listarInstanciasRepo } from "@/lib/repositories/instancias";
import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";

/** Inbox: ADMIN e ATENDENTE. A aba Automático (config de IA) é só do ADMIN. */
export default async function InboxPage() {
  const user = await exigirUsuario();
  const [conversas, instancias] = await Promise.all([
    listarConversasRepo(user.orgId),
    listarInstanciasRepo(user.orgId),
  ]);

  return (
    <InboxWorkspace
      inicial={conversas}
      instancias={instancias.map((i) => ({ id: i.id, nome: i.nome, status: i.status }))}
      podeAutomatico={podePapel(user.role as Papel, ["ADMIN"])}
    />
  );
}
