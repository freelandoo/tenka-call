import { describe, it, expect } from "vitest";
import { slugificar, nomeTecnico, validarNomeInstancia } from "@/lib/whatsapp/instancia";

describe("nome técnico da instância", () => {
  it("slugifica o nome amigável", () => {
    expect(slugificar("Comercial")).toBe("comercial");
    expect(slugificar("Suporte Técnico")).toBe("suporte-tecnico");
    expect(slugificar("  Vendas 2  ")).toBe("vendas-2");
    expect(slugificar("Pós-venda / SAC")).toBe("pos-venda-sac");
  });

  it("compõe empresa + instância", () => {
    expect(nomeTecnico("tenka", "Comercial")).toBe("tenka-comercial");
  });

  it("não colide entre empresas com o mesmo nome de instância", () => {
    expect(nomeTecnico("tenka", "Comercial")).not.toBe(nomeTecnico("outra", "Comercial"));
  });

  it("recusa nome que vira slug vazio", () => {
    expect(() => nomeTecnico("tenka", "###")).toThrow();
  });

  it("aceita só o alfabeto da Evolution", () => {
    expect(validarNomeInstancia("tenka-comercial")).toBe("tenka-comercial");
    expect(() => validarNomeInstancia("tenka comercial")).toThrow();
    expect(() => validarNomeInstancia("../etc/passwd")).toThrow();
  });
});
