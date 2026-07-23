"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Botao } from "@/components/ui/primitives";
import type { InstanciaLinha } from "@/components/instancias/InstanciasView";

/** O QR do WhatsApp expira em ~20s; renovamos um pouco antes. */
const RENOVAR_QR_MS = 20_000;
const CHECAR_STATUS_MS = 3_000;

type ResultadoQr =
  | { ok: true; conectado: boolean; qr: string | null; pairing: string | null }
  | { ok: false; erro: string };

/**
 * Pede um QR novo. Função de I/O fora do componente: não toca estado, então
 * pode ser chamada de dentro de um efeito sem provocar render em cascata.
 */
async function pedirQr(id: string): Promise<ResultadoQr> {
  try {
    const r = await fetch(`/api/instancias/${id}/qrcode`, { cache: "no-store" });
    const d = (await r.json().catch(() => ({}))) as {
      erro?: string;
      conectado?: boolean;
      qrBase64?: string | null;
      pairingCode?: string | null;
    };
    if (!r.ok) return { ok: false, erro: d?.erro ?? "Não foi possível gerar o QR Code." };
    return {
      ok: true,
      conectado: !!d.conectado,
      qr: d.qrBase64 ?? null,
      pairing: d.pairingCode ?? null,
    };
  } catch {
    return { ok: false, erro: "Falha de conexão com o servidor." };
  }
}

async function statusDaInstancia(id: string): Promise<InstanciaLinha | null> {
  try {
    const r = await fetch("/api/instancias", { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { instancias: InstanciaLinha[] };
    return d.instancias.find((i) => i.id === id) ?? null;
  } catch {
    return null;
  }
}

export function ModalQrCode({
  instancia,
  onFechar,
}: {
  instancia: InstanciaLinha;
  onFechar: () => void;
}) {
  const conectadoInicial = instancia.status === "CONNECTED";
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(!conectadoInicial);
  const [pareado, setPareado] = useState(conectadoInicial);
  const [numero, setNumero] = useState(instancia.numero);
  const vivo = useRef(true);
  const caixa = useRef<HTMLDivElement>(null);
  const molduraQr = useRef<HTMLDivElement>(null);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // Abertura em escala.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(caixa.current, { opacity: 0, scale: 0.94, duration: 0.28, ease: "power3.out" });
      });
      return () => mm.revert();
    },
    { scope: caixa },
  );

  /** Aplica no estado o que `pedirQr` trouxe. Sempre chamada depois de um await. */
  const aplicar = useCallback((r: ResultadoQr) => {
    if (!vivo.current) return;
    setCarregando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setErro("");
    if (r.conectado) {
      setPareado(true);
      return;
    }
    setQr(r.qr);
    setPairing(r.pairing);
  }, []);

  useEffect(() => {
    if (conectadoInicial) return;
    let ativo = true;
    (async () => {
      const r = await pedirQr(instancia.id);
      if (ativo) aplicar(r);
    })();
    return () => {
      ativo = false;
    };
  }, [conectadoInicial, instancia.id, aplicar]);

  // Renova o QR antes de expirar, enquanto ninguém pareou.
  useEffect(() => {
    if (pareado || erro) return;
    const t = setInterval(async () => {
      aplicar(await pedirQr(instancia.id));
    }, RENOVAR_QR_MS);
    return () => clearInterval(t);
  }, [pareado, erro, instancia.id, aplicar]);

  // Crossfade ao trocar o QR expirado por um novo.
  useGSAP(
    () => {
      if (!qr) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(molduraQr.current, { opacity: 0.25 }, { opacity: 1, duration: 0.35 });
      });
      return () => mm.revert();
    },
    { scope: molduraQr, dependencies: [qr] },
  );

  // Detecta o pareamento sem depender de ninguém clicar em nada.
  useEffect(() => {
    if (pareado) return;
    const t = setInterval(async () => {
      const atual = await statusDaInstancia(instancia.id);
      if (!vivo.current || !atual) return;
      setNumero(atual.numero);
      if (atual.status === "CONNECTED") setPareado(true);
    }, CHECAR_STATUS_MS);
    return () => clearInterval(t);
  }, [pareado, instancia.id]);

  /**
   * Confirmação manual: consulta o estado na hora, em vez de esperar a próxima
   * volta do polling. Cobre também o `connection.update` que não chegou.
   */
  async function confirmar() {
    setCarregando(true);
    setErro("");
    const atual = await statusDaInstancia(instancia.id);
    if (!vivo.current) return;
    setCarregando(false);
    if (atual?.status === "CONNECTED") {
      setNumero(atual.numero);
      setPareado(true);
    } else {
      setErro("Ainda não conectou. Escaneie o QR Code no celular e confirme de novo.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        ref={caixa}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[var(--color-borda)] bg-[var(--color-superficie)] p-6 text-center"
      >
        <h3 className="text-lg font-semibold">
          {pareado ? "WhatsApp conectado" : `Parear "${instancia.nome}"`}
        </h3>

        {pareado ? (
          <>
            <span className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">
              ✓
            </span>
            <p className="mt-3 text-sm text-[var(--color-fraco)]">
              As conversas recebidas entram sozinhas no <strong>Inbox</strong>.
            </p>
            {numero && <p className="mt-1 text-xs text-[var(--color-fraco)]">Número {numero}</p>}
            <p className="mt-3 text-xs text-[var(--color-fraco)]">
              Ninguém é respondido automaticamente — toda resposta sai daqui, digitada por alguém da
              equipe.
            </p>
            <Botao className="mt-5 w-full" onClick={onFechar}>
              Concluir
            </Botao>
          </>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-[var(--color-fraco)]">
              Aponte a câmera do celular da empresa
            </p>

            <div
              ref={molduraQr}
              className="mx-auto mt-5 flex h-[264px] w-[264px] items-center justify-center rounded-lg bg-white p-3"
            >
              {qr ? (
                // QR vem como data URI da Evolution; <img> evita a otimização do Next.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR Code para conectar o WhatsApp" className="h-full w-full" />
              ) : (
                <span className="text-sm text-neutral-500">
                  {erro ? "QR indisponível" : "Gerando QR Code…"}
                </span>
              )}
            </div>

            <ol className="mt-5 space-y-1 text-left text-sm text-[var(--color-fraco)]">
              <li>1. Abra o WhatsApp no celular</li>
              <li>2. Toque em ⋮ → Aparelhos conectados</li>
              <li>3. Toque em Conectar um aparelho</li>
              <li>4. Aponte a câmera para este QR Code</li>
            </ol>

            <p className="mt-3 text-xs text-[var(--color-fraco)]">O QR se renova sozinho a cada 20s.</p>

            {pairing && (
              <p className="mt-3 break-all text-xs text-[var(--color-fraco)]">
                Código de pareamento: <span className="text-[var(--color-texto)]">{pairing}</span>
              </p>
            )}

            {erro && <p className="mt-3 text-xs text-red-400">{erro}</p>}

            <Botao className="mt-5 w-full" onClick={confirmar} disabled={carregando}>
              {carregando ? "Verificando…" : "Já escaneei — confirmar"}
            </Botao>

            <div className="mt-3 flex gap-3">
              <Botao
                variante="secundario"
                className="flex-1"
                disabled={carregando}
                onClick={async () => {
                  setCarregando(true);
                  setErro("");
                  aplicar(await pedirQr(instancia.id));
                }}
              >
                Atualizar QR Code
              </Botao>
              <Botao variante="secundario" onClick={onFechar}>
                Fechar
              </Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
