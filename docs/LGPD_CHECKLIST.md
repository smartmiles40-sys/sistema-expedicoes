# Checklist de LGPD — Sistema de Expedições

> ⚠️ **Isto não é parecer jurídico.** É uma avaliação técnica / de engenharia de
> privacidade do sistema, para orientar o trabalho de adequação. A conformidade
> formal deve ser validada por um DPO / advogado especializado em proteção de dados.
>
> Status atualizado em: **2026-07-23** (primeira versão). Marque os itens conforme
> forem sendo resolvidos.

## Contexto

O sistema trata dados pessoais de passageiros para operar expedições: identificação
(nome, CPF, passaporte, foto), contato, endereço, contato de emergência, **dados de
saúde** (sensíveis), além de compartilhar dados com terceiros (Bitrix via n8n). Há
dois portais externos ao operacional: **ExpedAmigo** (viajante) e **Área do Líder**.

---

## ✅ O que já está razoável

- [x] Dados atrás de autenticação (sem exposição pública; policies `anon_read_dev` removidas).
- [x] Arquivos (passaporte, foto, vouchers) via **signed URLs com validade** (1h), não links permanentes.
- [x] Existe `audit_log` para **escritas** (INSERT/UPDATE/DELETE) nas tabelas críticas.
- [x] Portal ExpedAmigo **não expõe os documentos do próprio passageiro** (minimização).
- [x] Recusa de inscrição tem **exclusão definitiva** disponível (descarte real quando solicitado).

---

## ⚠️ Lacunas / itens a trabalhar (por prioridade)

### Alta prioridade

- [ ] **1. Aviso de privacidade + consentimento no formulário de inscrição.**
  Coletamos CPF, passaporte, foto, endereço, saúde. LGPD (Art. 9) exige informar o
  titular: quais dados, finalidade, com quem se compartilha (Bitrix/n8n), por quanto
  tempo. Hoje só há o checkbox `confirmou_veracidade` (que é sobre veracidade, não
  consentimento de tratamento). → Adicionar política de privacidade + aceite no `/inscricao`.

- [ ] **2. Senha em texto legível.** `acesso_senhas.senha_provisoria` guarda a senha em
  plaintext; admin vê e envia por WhatsApp. LGPD (Art. 46) pede segurança adequada.
  → Substituir por **link de 1º acesso com token** (sem senha crua). Melhora também o
  TODO de envio automático de acesso na aprovação.

- [ ] **3. Consentimento específico para dados de saúde (sensíveis).** Coletamos condições
  médicas / restrições / saúde = dado sensível (Art. 11), que exige consentimento
  destacado e base legal específica + acesso restrito. → Consentimento próprio no form +
  restringir quem vê esses campos.

### Média prioridade

- [ ] **4. Controle de acesso por papel (RLS).** RLS hoje é permissivo ("autenticado → tudo").
  Os "Masters" da Área do Líder veem todas as expedições e documentos. LGPD pede
  minimização. → Refinar RLS por papel/necessidade antes de escalar.

- [ ] **5. Compartilhamento com terceiros (Bitrix / n8n).** Enviamos dados (incl. signed URL
  do passaporte) para o Bitrix via n8n. → Declarar no aviso de privacidade + garantir
  **contrato de operador** com esses fornecedores.

- [ ] **6. Direitos do titular.** Não há caminho para o passageiro pedir acesso / correção /
  exclusão dos próprios dados. → Documentar e oferecer um canal (e-mail/DPO) para exercício
  de direitos (não precisa ser automático).

- [ ] **7. Política de retenção / descarte.** Inscrições recusadas (e dados em geral) ficam
  guardadas indefinidamente. LGPD tem princípio de não guardar além do necessário.
  → Definir prazos de retenção e rotina de descarte.

### Baixa prioridade / melhorias

- [ ] **8. Log de acesso aos portais.** Hoje **não** há registro de quem acessou o ExpedAmigo /
  Área do Líder (o `audit_log` só cobre escritas, não logins/leituras). → Criar registro de
  acesso (CPF, data/hora, sucesso/falha; IP com cautela, pois IP também é dado pessoal).
  Útil para accountability e para responder incidentes.

- [ ] **9. Registro das operações de tratamento (ROPA).** Manter um inventário do que se
  coleta, por quê, base legal, retenção e compartilhamentos (exigível pela ANPD).

- [ ] **10. Resposta a incidentes.** Definir procedimento de notificação (ANPD + titulares)
  em caso de vazamento.

---

## Notas de implementação (referências no código)

- Senha do portal: `lib/acesso-senha.ts`, `app/(app)/expedicoes/[id]/passageiros/expedamigo-actions.ts`,
  `app/amigo/actions.ts` (`entrarExpedAmigo`, `definirSenhaExpedAmigo`), tabela `acesso_senhas`.
- Coleta de dados sensíveis (saúde): `lib/inscricao/core.ts`, `app/inscricao/InscricaoForm.tsx`.
- Compartilhamento com Bitrix: `lib/bitrix/outbound.ts`, `app/(app)/inscricoes/actions.ts` (`aprovarInscricao`).
- Auditoria de escrita: tabela `audit_log` + triggers (migration `0001_initial_schema.sql`).
- RLS: políticas nas migrations (`0001` e seguintes) — hoje permissivas para autenticados.
