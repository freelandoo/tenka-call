<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tenka Call

- Toda tabela de negócio tem `orgId`. **Nenhuma** função de repositório lê ou
  escreve sem receber `orgId` como primeiro argumento.
- `orgId` vem sempre da sessão (`exigirSessaoApi().user.orgId`). Nunca do corpo,
  da query ou de header.
- Recurso de outra empresa responde **404**, não 403.
- Não existe resposta automática. Nada que rode a partir do webhook pode importar
  o módulo que envia mensagem — há teste de arquitetura garantindo isso.
- Telefone em log sempre redigido (últimos 4 dígitos).
- Animação sempre dentro de `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`.
