# Roadmap de Melhorias — Sistema de Expedições

> Criado em 2026-06-09. 20 tarefas em 4 frentes. Marcar `[x]` ao concluir.
> Contexto: app é desktop-first por design (planilha turbinada), mas precisa ser
> **usável em tablet/celular** para consulta em campo — responsivo ≠ mobile-first.

## A. Responsividade (1–7)

- [ ] **1. Sidebar responsiva** — `components/layout/Sidebar.tsx` é fixa, sem breakpoints. Em `<1024px` colapsar para ícones com tooltip; em `<768px` virar drawer via hambúrguer no Header. Persistir estado em localStorage.
- [ ] **2. Tabelas com scroll horizontal + 1ª coluna sticky** — `DataTable`, `PassageirosTabela`, `CustosTabela`, `PagamentosTabela`: wrapper `overflow-x-auto`, coluna identificadora sticky-left com fundo sólido, sombra de overflow.
- [ ] **3. Visão em cards no mobile** — abaixo de `md`, Expedições e Passageiros viram lista de cards (nome, status, datas, contadores). Tabela continua sendo a visão principal no desktop.
- [ ] **4. Dashboard responsivo** — grid de KPIs 4→2→1 colunas, recharts em `ResponsiveContainer`, legendas que não estouram.
- [ ] **5. Drawers fullscreen no mobile** — `components/ui/Drawer.tsx`: 100% de largura (ou bottom sheet) abaixo de 640px, header fixo, fechar alcançável com o polegar. Afeta os 10+ drawers.
- [ ] **6. Tabs do detalhe com scroll + header compacto** — `ExpedicaoTabsNav` com `overflow-x-auto`/snap; `ExpedicaoHeader` esconde métricas secundárias em tela estreita.
- [ ] **7. Touch** — alvos ≥40px em `pointer:coarse` (checkbox, células, botões-ícone); `RoomingBoard` com `TouchSensor` do dnd-kit (delay/tolerance) pra arrastar no tablet sem brigar com scroll.

## B. Performance e robustez (8–11)

- [ ] **8. `loading.tsx` em todas as rotas** — hoje nenhuma rota tem; usar `Skeleton.tsx` com formato de tabela/cards correspondente.
- [ ] **9. `error.tsx` + `not-found.tsx`** — global e por grupo de rota, pt-BR, botão "Tentar novamente" via `reset()`; 404 amigável pra expedição/pax inexistente.
- [ ] **10. Memoizar tabelas TanStack** — `columns` em `useMemo`, callbacks estáveis, `data` sem recriação por render. Mata lag de digitação na edição inline com 30+ pax.
- [ ] **11. Code-split** — `next/dynamic` para recharts (Dashboard) e dnd-kit (Rooming) com skeleton de fallback; tira ~100kb+ do first load das demais rotas.

## C. Features (12–18)

- [ ] **12. Busca global no command palette** — pax por nome/CPF cross-expedição, expedições e fornecedores; pulo direto pra ficha.
- [ ] **13. Exportar CSV** — passageiros, custos e pagamentos, respeitando filtros ativos; separador `;` + BOM UTF-8 (Excel pt-BR).
- [ ] **14. Persistir estado das tabelas** — sorting/filtros/colunas visíveis em localStorage por tabela/expedição + seletor de colunas.
- [ ] **15. Margem/lucratividade** — receita (pagantes × preço) vs custos convertidos por câmbio; badge `critico` abaixo de `MARGEM_MINIMA`; ranking no dashboard.
- [ ] **16. Visão "Hoje" no dashboard** — processos vencidos/vencendo em 7 dias, pagamentos da semana, docs/vistos pendentes com embarque próximo; cada item linka pra tab.
- [ ] **17. Undo em deletes** — soft-delete + toast sonner com "Desfazer" (5s) no lugar do confirm, para pax/custo/pagamento/checklist.
- [ ] **18. Impressão/PDF** — `@media print` + botão Imprimir na rooming list (formato hotel/DMC) e lista de passageiros; esconder shell na impressão.

## D. Qualidade (19–20)

- [ ] **19. Acessibilidade** — foco visível na paleta, `aria-label` em botões só-ícone, focus trap/Esc/retorno de foco nos drawers, roles nas tabelas editáveis.
- [ ] **20. Smoke test Playwright + build limpo** — visitar todas as rotas em viewport desktop e 390px sem erro de console; `npm run build` zerado. Rede de segurança das outras 19.

## Ordem sugerida de execução

`20` (rede de segurança) → `8, 9` (rápidas, alto impacto) → `1, 2, 5, 6` (núcleo responsivo) → `10, 11` → `3, 4, 7` → `12–18` (features) → `19`.
