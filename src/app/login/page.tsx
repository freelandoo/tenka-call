import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/session";
import { rotaInicial, type Papel } from "@/lib/auth/papeis";
import { Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";
import { FormLogin } from "@/components/login/FormLogin";

export default async function LoginPage() {
  const user = await usuarioAtual();
  if (user) redirect(rotaInicial(user.role as Papel));

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <Card>
          <h1 className="mb-1 text-xl font-semibold">Tenka Call</h1>
          <p className="mb-6 text-sm text-[var(--color-fraco)]">Central de atendimento</p>
          <FormLogin />
        </Card>
      </Reveal>
    </main>
  );
}
