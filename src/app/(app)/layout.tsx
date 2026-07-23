import { exigirUsuario } from "@/lib/auth/guards";
import { Sidebar } from "@/components/Sidebar";
import type { Papel } from "@/lib/auth/papeis";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await exigirUsuario();

  return (
    <div className="flex min-h-screen">
      <Sidebar nome={user.nome} papel={user.role as Papel} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
