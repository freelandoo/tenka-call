import { describe, it, expect, vi, afterEach } from "vitest";
import { IAError, listarModelos } from "@/lib/ia/provedores";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adaptadores de provedor de IA", () => {
  it("lista modelos do Claude a partir do /v1/models", async () => {
    global.fetch = mockFetch(200, {
      data: [
        { id: "claude-opus-4-8", display_name: "Claude Opus 4.8" },
        { id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5" },
      ],
    });

    const modelos = await listarModelos("claude", "sk-ant-xxx");
    expect(modelos).toEqual([
      { id: "claude-opus-4-8", nome: "Claude Opus 4.8" },
      { id: "claude-haiku-4-5", nome: "Claude Haiku 4.5" },
    ]);
  });

  it("filtra a lista da OpenAI para só modelos de chat", async () => {
    global.fetch = mockFetch(200, {
      data: [
        { id: "gpt-4o" },
        { id: "text-embedding-3-small" },
        { id: "whisper-1" },
        { id: "o3-mini" },
        { id: "dall-e-3" },
      ],
    });

    const modelos = await listarModelos("openai", "sk-xxx");
    expect(modelos.map((m) => m.id)).toEqual(["gpt-4o", "o3-mini"]);
  });

  it("chave inválida (401) vira IAError 400 com mensagem clara", async () => {
    global.fetch = mockFetch(401, { error: { message: "invalid api key" } });

    await expect(listarModelos("claude", "errada")).rejects.toMatchObject({
      name: "IAError",
      status: 400,
    });
  });

  it("chave vazia nem chega a chamar o provedor", () => {
    const fetchSpy = mockFetch(200, {});
    global.fetch = fetchSpy;

    expect(() => listarModelos("openai", "   ")).toThrow(IAError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
