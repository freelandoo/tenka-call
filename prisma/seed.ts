import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

async function main() {
  const slug = (process.env.SEED_ORG_SLUG ?? "tenka").trim();
  const nome = (process.env.SEED_ORG_NOME ?? "Tenka").trim();
  const login = (process.env.SEED_ADMIN_LOGIN ?? "admin").trim().toLowerCase();
  const senha = process.env.SEED_ADMIN_SENHA;

  if (!senha) {
    throw new Error("Defina SEED_ADMIN_SENHA no ambiente antes de rodar o seed.");
  }

  const org = await prisma.org.upsert({
    where: { slug },
    update: { nome },
    create: { slug, nome },
  });

  // Idempotente e determinístico: rodar o seed (inclusive depois de reiniciar o
  // banco) sempre deixa o admin com a senha do `SEED_ADMIN_SENHA` e pronto para
  // entrar direto — sem forçar troca. Por isso o `update` também reescreve a senha.
  const passwordHash = await hash(senha);
  await prisma.user.upsert({
    where: { login },
    update: {
      passwordHash,
      role: "ADMIN",
      ativo: true,
      senhaProvisoria: false,
    },
    create: {
      orgId: org.id,
      login,
      nome: "Administrador",
      role: "ADMIN",
      passwordHash,
      senhaProvisoria: false,
    },
  });

  console.log(`Empresa "${org.slug}" e admin "${login}" prontos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
