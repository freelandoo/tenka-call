/** Rótulos em português das classificações — usados na validação e na tela. */

import type { ConversaInteresse, LeadEstagio, WhatsappStatus } from "@prisma/client";

export const INTERESSE_LABEL: Record<ConversaInteresse, string> = {
  nao_classificado: "Não classificado",
  com_interesse: "Com interesse",
  sem_interesse: "Sem interesse",
  perdido: "Perdido",
  convertido: "Convertido",
};

export const ESTAGIO_LABEL: Record<LeadEstagio, string> = {
  novo: "Novo",
  interesse: "Interesse",
  qualificado: "Qualificado",
  perdido: "Perdido",
  convertido: "Convertido",
};

export const STATUS_LABEL: Record<WhatsappStatus, string> = {
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
};

export function ehInteresse(valor: unknown): valor is ConversaInteresse {
  return typeof valor === "string" && valor in INTERESSE_LABEL;
}
