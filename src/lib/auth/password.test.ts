import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("verifica a senha correta", async () => {
    const hash = await hashPassword("senha-boa-123");
    expect(await verifyPassword(hash, "senha-boa-123")).toBe(true);
  });

  it("rejeita a senha errada", async () => {
    const hash = await hashPassword("senha-boa-123");
    expect(await verifyPassword(hash, "senha-ruim")).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt por hash)", async () => {
    const a = await hashPassword("igual");
    const b = await hashPassword("igual");
    expect(a).not.toBe(b);
  });

  it("devolve false em hash corrompido em vez de lançar", async () => {
    expect(await verifyPassword("nao-e-um-hash", "qualquer")).toBe(false);
  });
});
