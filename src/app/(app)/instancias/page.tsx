import { exigirPapel } from "@/lib/auth/guards";
import { listarInstanciasRepo } from "@/lib/repositories/instancias";
import { configEvolution } from "@/lib/whatsapp/evolution";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { InstanciasView } from "@/components/instancias/InstanciasView";

/**
 * A primeira renderização lê só o banco — a página não espera a rede da
 * Evolution. A reconciliação acontece logo depois, do componente cliente.
 */
export default async function InstanciasPage() {
  const user = await exigirPapel(["ADMIN"]);
  const instancias = await listarInstanciasRepo(user.orgId);

  return (
    <InstanciasView
      configurado={!!configEvolution()}
      inicial={instancias.map((i) => ({
        id: i.id,
        nome: i.nome,
        evolutionInstance: i.evolutionInstance,
        status: i.status,
        numero: formatarTelefone(i.numeroConectado),
        ultimoErro: i.ultimoErro,
        ultimoEstadoEm: i.ultimoEstadoEm?.toISOString() ?? null,
      }))}
    />
  );
}
