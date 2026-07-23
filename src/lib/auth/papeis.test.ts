import { describe, it, expect } from "vitest";
import { podePapel, rotaInicial, type Papel } from "@/lib/auth/papeis";

describe("papeis", () => {
  it("aceita o papel exigido", () => {
    expect(podePapel("ADMIN", ["ADMIN"])).toBe(true);
    expect(podePapel("ATENDENTE", ["ADMIN", "ATENDENTE"])).toBe(true);
  });

  it("recusa papel fora da lista", () => {
    expect(podePapel("ATENDENTE", ["ADMIN"])).toBe(false);
  });

  it("recusa valor desconhecido vindo do banco", () => {
    expect(podePapel("FAXINEIRO" as Papel, ["ADMIN", "ATENDENTE"])).toBe(false);
  });

  it("manda os dois papéis para o inbox — é onde o trabalho acontece", () => {
    expect(rotaInicial("ADMIN")).toBe("/inbox");
    expect(rotaInicial("ATENDENTE")).toBe("/inbox");
  });
});
