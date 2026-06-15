# Como preencher os modelos de importação

Dois arquivos nesta pasta. Preencha-os com seus dados reais e me devolva
(o caminho do arquivo ou colando o conteúdo aqui no chat).

> Dica: abra no Excel/Google Sheets. O separador é `;` (ponto e vírgula).
> Datas podem ser `DD/MM/AAAA` (ex.: `15/07/2024`). Valores em reais: `42000`
> ou `42.000,00`. As linhas de exemplo são só ilustração — apague e ponha as suas.

## 1. `expedicoes-modelo.csv` — as expedições que já aconteceram

| Coluna | Obrigatório? | Observação |
|---|---|---|
| `codigo` | Sim | Identificador único, ex.: `PERU-AGO2023`. É ele que liga os passageiros à expedição. |
| `nome` | Sim | Nome de exibição, ex.: `Peru – Machu Picchu Ago 2023`. |
| `destino` | Sim | País/região. Casa com as regras de requisitos (Peru, Japão, Egito, Argentina, Chile, Itália…). |
| `data_embarque` | Sim | `DD/MM/AAAA`. |
| `data_retorno` | Sim | `DD/MM/AAAA`. |
| `status` | Não | Para expedições passadas use `Concluída`. |
| `pax` | Não | Nº de passageiros planejados. |
| `preco_venda_brl` | Não | Preço de venda por pessoa. |

## 2. `passageiros-modelo.csv` — quem viajou (e em qual expedição)

| Coluna | Obrigatório? | Observação |
|---|---|---|
| `expedicao_codigo` | Sim | Tem que ser **igual** a um `codigo` do arquivo de expedições. |
| `nome_completo` | Sim | — |
| `data_nascimento` | Não | `DD/MM/AAAA`. |
| `cpf` | Não | Usado para identificar a mesma pessoa entre expedições. |
| `passaporte` | Não | — |
| `validade_passaporte` | Não | `DD/MM/AAAA`. |
| `email` | Não | — |
| `telefone` | Não | — |
| `tipo` | Não | `Pagante`, `Cortesia` ou `Líder` (padrão: Pagante). |
| `status_reserva` | Não | Para quem já viajou, use `Confirmado`. |
| `valor_contratado` | Não | Valor total contratado. |
| `valor_pago` | Não | Quanto foi pago (para histórico, normalmente = contratado). |

### Como a "mesma pessoa" é reconhecida
A pessoa que aparece em várias expedições é consolidada pelo **CPF** (ou, na
falta dele, por e-mail/nome). É assim que a aba **Passageiros** conta "quantas
expedições cada um já fez". Então, para contar certo, **use o mesmo CPF** para a
mesma pessoa em todas as linhas dela (veja a Maria Souza no exemplo, que aparece
em duas expedições).

## ⚠️ Sobre dados reais e privacidade
CPF e passaporte são dados sensíveis. Se formos guardar no **Supabase** (banco
real e privado), tudo bem. Se a ideia for só demonstração no código que vai pro
GitHub público, **não** coloque CPF/passaporte reais — use dados fictícios.
