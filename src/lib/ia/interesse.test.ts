import { describe, it, expect } from "vitest";
import { medirInteresse } from "@/lib/ia/interesse";

describe("medição de interesse", () => {
  it("sobe com sinais de compra e desce com recusa", () => {
    expect(medirInteresse("quero contratar, quanto custa?", 0).nota).toBeGreaterThan(40);
    expect(medirInteresse("não tenho interesse", 50).nota).toBeLessThan(50);
  });

  it("prende a nota entre 0 e 100", () => {
    expect(medirInteresse("quero comprar fechar contratar", 90).nota).toBe(100);
    expect(medirInteresse("não não não sem interesse", 5).nota).toBe(0);
  });

  it("ignora acentos e casa palavra inteira", () => {
    // "preço" com acento e "sim" não deve casar dentro de "assim".
    expect(medirInteresse("qual o preço?", 0).delta).toBeGreaterThan(0);
    expect(medirInteresse("assim mesmo", 0).delta).toBe(0);
  });

  it("detecta pedido de humano (handoff)", () => {
    expect(medirInteresse("quero falar com um atendente", 0).pedeHumano).toBe(true);
    expect(medirInteresse("me manda o valor", 0).pedeHumano).toBe(false);
  });
});
