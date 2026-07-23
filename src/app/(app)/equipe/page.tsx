import { exigirPapel } from "@/lib/auth/guards";
import { listarUsuariosRepo } from "@/lib/repositories/usuarios";
import { EquipeView } from "@/components/equipe/EquipeView";

export default async function EquipePage() {
  const user = await exigirPapel(["ADMIN"]);
  const usuarios = await listarUsuariosRepo(user.orgId);

  return (
    <EquipeView
      meuId={user.id}
      usuarios={usuarios.map((u) => ({
        id: u.id,
        login: u.login,
        nome: u.nome,
        role: u.role,
        ativo: u.ativo,
        senhaProvisoria: u.senhaProvisoria,
      }))}
    />
  );
}
