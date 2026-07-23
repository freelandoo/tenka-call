import { describe, it, expect } from "vitest";
import {
  estagioAtual,
  montarSystemPrompt,
  sequenciaEstagios,
  type PlaybookPrompt,
} from "@/lib/ia/prompt";

const base: PlaybookPrompt = {
  objetivo: "Vender criação de site",
  contexto: "Trabalhamos com pequenas empresas.",
  saudacaoAtiva: true,
  desenvolvimentoAtiva: true,
  agendamentoAtiva: true,
  fecho: "reuniao",
  linkFecho: null,
  servicos: [{ nome: "Site", preco: "a partir de R$299", descricao: null }],
};

describe("prompt do atendente automático", () => {
  it("a sequência de estágios respeita os que estão ligados", () => {
    expect(sequenciaEstagios(base)).toEqual([
      "saudacao",
      "desenvolvimento",
      "agendamento",
      "encerrado",
    ]);
    const semSaudacao = { ...base, saudacaoAtiva: false, agendamentoAtiva: false };
    expect(sequenciaEstagios(semSaudacao)).toEqual(["desenvolvimento", "encerrado"]);
  });

  it("o estágio avança com o número de mensagens e satura em encerrado", () => {
    expect(estagioAtual(base, 0)).toBe("saudacao");
    expect(estagioAtual(base, 1)).toBe("desenvolvimento");
    expect(estagioAtual(base, 2)).toBe("agendamento");
    expect(estagioAtual(base, 99)).toBe("encerrado");
  });

  it("o prompt leva serviços, contexto e a instrução do estágio", () => {
    const sys = montarSystemPrompt(base, "desenvolvimento", 40);
    expect(sys).toContain("a partir de R$299");
    expect(sys).toContain("Trabalhamos com pequenas empresas");
    expect(sys).toContain("40/100");
    expect(sys.toLowerCase()).toContain("desenvolvimento");
  });

  it("fecho por link coloca o link na instrução", () => {
    const sys = montarSystemPrompt(
      { ...base, fecho: "link", linkFecho: "https://tenka.com/cadastro" },
      "agendamento",
      70,
    );
    expect(sys).toContain("https://tenka.com/cadastro");
  });
});
