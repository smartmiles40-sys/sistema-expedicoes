# Integração Bitrix24 ↔ n8n ↔ Sistema de Expedições

Este documento descreve como configurar a sincronização de **passageiros** e **expedições** do Bitrix24 para o nosso app, usando **n8n** como camada de orquestração.

## Arquitetura

```
Bitrix24 CRM         n8n (workflow)             Sistema de Expedições
────────────         ────────────────           ────────────────────
ONCRMDEALADD    →    Webhook Trigger      →    POST /api/bitrix/passageiro-sync
ONCRMDEALUPDATE →    HTTP Request (Bitrix)     [valida x-webhook-secret]
ONCRMCONTACTUPDATE   ↓                          [Zod parse]
                     Function (transformar)     [upsert por bitrix_deal_id]
                     ↓                          [audit_log]
                     HTTP Request (POST app)
```

## 1. Configurar webhook no Bitrix24

Em **CRM → Marketplace → Webhooks** crie um **outgoing webhook**:

- URL: a URL pública do seu n8n (ex: `https://n8n.suaempresa.com/webhook/bitrix-deal`)
- Eventos:
  - `ONCRMDEALADD`
  - `ONCRMDEALUPDATE`
  - `ONCRMCONTACTUPDATE`

## 2. Workflow no n8n (descrição em texto)

```
Trigger: Webhook ───→ Function: detectar tipo evento ───→ Switch:
                                                          ├─ deal      → HTTP GET Bitrix CRM Deal + Contact
                                                          └─ contact   → HTTP GET Bitrix CRM Contact

→ Function: achatar payload (transformar UF_CRM_* em chaves planas)
   { bitrix_deal_id, bitrix_contact_id, expedicao_codigo, estagio_deal, nome_completo, email, ... }

→ HTTP Request: POST {APP_URL}/api/bitrix/passageiro-sync
   Headers: x-webhook-secret: ${WEBHOOK_SECRET}
   Body: payload achatado

→ IF resposta.ok:
   → opcionalmente: log no Slack / criar tarefa
   ELSE:
   → notificar erro (Slack/email)
```

## 3. Mapeamento de campos custom (Bitrix → app)

Crie estes campos custom (UF_CRM_*) nos deals/contacts no Bitrix:

| Campo no Bitrix              | Chave no payload      | Tipo      | Obs |
|------------------------------|-----------------------|-----------|-----|
| `UF_CRM_CPF`                 | `cpf`                 | string    | XXX.XXX.XXX-XX |
| `UF_CRM_PASSAPORTE`          | `passaporte`          | string    | |
| `UF_CRM_PASSAPORTE_VALIDADE` | `validade_passaporte` | date      | YYYY-MM-DD |
| `UF_CRM_DATA_NASCIMENTO`     | `data_nascimento`     | date      | |
| `UF_CRM_EXPEDICAO_CODIGO`    | `expedicao_codigo`    | string    | Ex: `PERU-AGO2026` (deve bater com `expedicoes.codigo`) |
| `UF_CRM_VOO_NACIONAL`        | `voo_nacional_necessario` | boolean | |
| `UF_CRM_OBSERVACOES`         | `observacoes`         | string    | |

## 4. Mapeamento de estágios (deal STAGE_ID → status_reserva)

Em `lib/bitrix/stage-mapping.ts`:

| Stage Bitrix    | status_reserva |
|-----------------|----------------|
| NEW / LEAD / 1  | Lead           |
| PROPOSAL / 2,3  | Pré-reserva    |
| WON / 4         | Confirmado     |
| LOST / 5        | Cancelado      |

Ajuste para os IDs reais do seu pipeline.

## 5. Estrutura do payload esperado (passageiro-sync)

```json
{
  "bitrix_deal_id": "12345",
  "bitrix_contact_id": "67890",
  "expedicao_codigo": "PERU-AGO2026",
  "estagio_deal": "WON",
  "nome_completo": "João da Silva",
  "email": "joao@example.com",
  "telefone": "+55 11 99999-1234",
  "cpf": "111.222.333-44",
  "passaporte": "FA123456",
  "validade_passaporte": "2028-06-15",
  "data_nascimento": "1985-03-22",
  "voo_nacional_necessario": true,
  "observacoes": "Vegetariano"
}
```

Resposta sucesso:
```json
{ "ok": true, "passageiro_id": "uuid...", "action": "created" }
```

Resposta erro:
```json
{ "ok": false, "error": "Expedição PERU-AGO2026 não encontrada" }
```

## 6. Variáveis de ambiente do app

```
WEBHOOK_SECRET=string-aleatoria-64-chars
N8N_RESYNC_WEBHOOK_URL=https://n8n.../webhook/resync
```

`WEBHOOK_SECRET`: comparar header `x-webhook-secret` em todas as rotas `/api/bitrix/*`.

`N8N_RESYNC_WEBHOOK_URL`: usado pelo botão "Forçar resync" no header da expedição → o app dispara um webhook pro n8n que re-busca tudo do Bitrix.

## 7. Testar com curl

```bash
curl -X POST http://localhost:3000/api/bitrix/passageiro-sync \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev-secret-trocar-em-prod-c2a9f7e1b3d5" \
  -d '{
    "bitrix_deal_id": "TEST-001",
    "expedicao_codigo": "PERU-AGO2026",
    "estagio_deal": "WON",
    "nome_completo": "Teste Curl"
  }'
```

```bash
curl http://localhost:3000/api/health
```

## 8. Health check

`GET /api/health` retorna `{ ok: true, time: "..." }`. Configure o n8n pra monitorar a cada 5 min e disparar alerta se cair.
