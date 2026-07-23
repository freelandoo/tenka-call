import { exigirUsuario } from "@/lib/auth/guards";
import { Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";
import { AlterarSenha } from "@/components/perfil/AlterarSenha";

export default async function PerfilPage() {
  const user = await exigirUsuario();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Reveal>
        <h1 className="text-xl font-semibold">Perfil</h1>
      </Reveal>
      <Reveal delay={0.05}>
        <Card>
          <p className="text-sm font-medium">{user.nome}</p>
          <p className="text-xs text-[var(--color-fraco)]">
            {user.login} · {user.role === "ADMIN" ? "Administrador" : "Atendente"}
          </p>
        </Card>
      </Reveal>
      <Reveal delay={0.1}>
        <AlterarSenha obrigatoria={user.senhaProvisoria} />
      </Reveal>
    </div>
  );
}
