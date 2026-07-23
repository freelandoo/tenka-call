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

  await prisma.user.upsert({
    where: { login },
    update: {},
    create: {
      orgId: org.id,
      login,
      nome: "Administrador",
      role: "ADMIN",
      passwordHash: await hash(senha),
      senhaProvisoria: true,
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
