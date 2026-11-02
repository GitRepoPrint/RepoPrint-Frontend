# RepoPrint — Frontend

Frontend do RepoPrint: a "impressão digital" de um repositório GitHub, com threat modeling (STRIDE),
riscos de privacidade (LINDDUN/RGPD), Data Flow Diagram e métricas da equipa.

Ainda **não há backend**: todos os dados vêm de mocks em `src/lib/api/mock/` e o login é simulado.
A app funciona de ponta a ponta, mas mostra sempre os mesmos dados de exemplo.

## Requisitos

- **Node.js 20.9 ou mais recente** (exigido pelo Next.js 16). Verificar com `node -v`.
- **pnpm** (o projeto tem `pnpm-lock.yaml`). Se não estiver instalado: `corepack enable` (vem com o Node)
  ou `npm install -g pnpm`.

## Arrancar em desenvolvimento

```bash
pnpm install     # só da primeira vez (ou quando o package.json mudar)
pnpm dev         # http://localhost:3000
```

O `pnpm dev` recarrega a página sozinho quando se grava um ficheiro.

> A app é feita para **computador** (browser de desktop). Não há layout para telemóvel: em ecrãs com
> menos de ~760 px de largura o conteúdo não se adapta. Abrir o `pnpm dev` a partir de outro dispositivo da rede também não funciona
> (o Next.js só aceita os pedidos de desenvolvimento vindos de `localhost`).

## Versão de produção (local)

```bash
pnpm build       # compila e verifica os tipos
pnpm start       # http://localhost:3000
```

## Outros comandos

```bash
pnpm lint        # ESLint (regras do Next.js + TypeScript)
```

## Como experimentar a app

| Onde | O que fazer |
|---|---|
| `/` | Colar um URL de um repositório GitHub público (ou deixar vazio para o exemplo `deti-org/payment-service`) e carregar em **Analyze Repository**. **Download Report** abre a impressão / "Guardar como PDF". |
| `/login`, `/signup` | O login é simulado: **Continue with GitHub**, ou qualquer email válido com uma password de 8+ caracteres. A sessão é um cookie (`rp_session`) que dura 24 h. |
| `/repositories` | Lista de repositórios de exemplo. **Associate repository** acrescenta um (fica guardado no `localStorage` do browser). |
| `/repositories/<org>--<repo>` | Dashboard com 3 tabs (Threats, DFD, Team). **Export PDF Report** imprime o relatório formal. |
| `/repositories/<org>--<repo>/dfd` | Editor do DFD: arrastar componentes, ligar nós, Auto Layout, **Save Diagram** (guarda no `localStorage`) e **Export SVG**. |

Para voltar ao estado inicial basta limpar os dados do site no browser (cookies + localStorage).

## Estrutura

```
src/
  app/              rotas (App Router). globals.css importa os estilos de src/styles/
  components/       componentes React, organizados por ecrã (instant, dashboard, canvas, report, ...)
  hooks/            hooks partilhados
  lib/
    api/            "contrato" com o backend: types.ts + funções que hoje devolvem mocks (mock/)
    auth/           sessão simulada, validação dos formulários, redirect depois do login
    dfd/            modelo do diagrama, auto-layout (Dagre) e exportação SVG
  proxy.ts          protege /repositories/* (no Next.js 16 o antigo middleware chama-se proxy)
  styles/           CSS por área (base, layout, landing, dashboard-*, canvas, report, ...)
```

### Ligar ao backend (quando existir)

As páginas e os componentes só falam com `src/lib/api/*.ts`. Basta trocar o corpo dessas funções por
chamadas `fetch`, mantendo a mesma assinatura e os tipos de `src/lib/api/types.ts`:

- `analyzeInstant()` (análise instantânea): em caso de erro, lançar `ApiError` (`lib/api/errors.ts`) com uma
  mensagem para o utilizador. A landing mostra-a num toast e mantém o resultado anterior.
- `getRepositoryAnalysis()` (dashboard e canvas): devolver `null` se o repositório não existir (página 404).
  Qualquer outro erro é apanhado por `src/app/repositories/error.tsx` (ecrã com "Try again").

## Notas

- Esta versão do Next.js (16) tem APIs diferentes das versões anteriores. Ver `AGENTS.md` e a documentação em
  `node_modules/next/dist/docs/`.
- O histórico das alterações e das decisões tomadas está em `ChangesAndDecisions.md`.
