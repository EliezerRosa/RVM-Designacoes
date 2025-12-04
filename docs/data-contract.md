# Contrato JSON e Preparação para Persistência

Este documento mantém o contrato oficial entre o motor (`AssignmentEngine`), futuras APIs e a UI. Todos os módulos devem importar os tipos de `src/types/models.ts` para permanecer sincronizados.

## Endpoint `POST /api/generateAssignments`

### Request (`GenerateAssignmentsRequest`)

```jsonc
{
  "meetingDate": "2025-12-01",
  "parts": [ /* MeetingPart[] */ ],
  "publishers": [ /* Publisher[] */ ],
  "history": [ /* AssignmentHistory[] */ ]
}
```

- `meetingDate`: data ISO (YYYY-MM-DD) usada para cálculo de cooldown e horários.
- `parts`: pauta completa na ordem em que deve ser cronometada. Todos os campos exigidos em `MeetingPart` devem estar presentes.
- `publishers`: publicadores visíveis para o filtro rígido. Flags de aprovação e disponibilidade devem vir resolvidas do backend (não serão inferidas no front).
- `history`: últimas designações por publicador. Mesmo um histórico curto (8 semanas) já alimenta a penalidade de cooldown.

### Response (`GenerateAssignmentsResponse`)

```jsonc
{
  "assignments": [
    {
      "assignmentId": "uuid",
      "meetingPartId": "part-001",
      "principalPublisherId": "pub-001",
      "secondaryPublisherId": "pub-010",
      "approvalStatus": "PENDING_APPROVAL",
      "startTime": "19:30",
      "endTime": "19:40"
    }
  ],
  "warnings": [
    {
      "type": "HELPER_MISSING",
      "meetingPartId": "part-005",
      "message": "Parte 'Cultive o Interesse' ficou sem ajudante elegível"
    }
  ]
}
```

- `approvalStatus`: inicia como `PENDING_APPROVAL` quando a parte exige ancião ou o publicador tem `approvalNeeded = true`; caso contrário permanece `DRAFT`.
- `startTime`/`endTime`: retornam preenchidos pelo `TimingCalculator` com base no horário padrão 19:30 e na duração de cada parte.
- `warnings`: lista de avisos que devem ser exibidos na UI para que o SM veja lacunas (ver seção abaixo).

### Warnings retornados {#assignment-warnings}

Cada warning segue a estrutura abaixo:

```jsonc
{
  "type": "HELPER_MISSING",
  "meetingPartId": "part-005",
  "message": "Parte 'Cultive o Interesse' ficou sem ajudante elegível"
}
```

- `type`: enum previsível (`NO_CANDIDATE`, `HELPER_MISSING`, `API_FALLBACK`).
- `meetingPartId`: parte relacionada (quando aplicável) para que a UI destaque o card correto.
- `message`: texto pronto em português destinado ao SM.

## Consumo pelo Front-end {#frontend-api}

- O cliente React executa `POST` para a URL definida em `VITE_ASSIGNMENTS_API`. Caso não esteja configurada, o fallback padrão é `http://127.0.0.1:3333/api/generateAssignments` (servidor mock em `scripts/mock-api.ts`).
- Configure `.env` a partir de `.env.example`, ajustando `VITE_ASSIGNMENTS_API` conforme o ambiente.
- Em caso de falha de rede/API, o front-end recorre ao `AssignmentEngine` local e exibe aviso “API indisponível. Exibindo dados do motor local.”
- O payload enviado segue exatamente o contrato `GenerateAssignmentsRequest`; qualquer campo adicional deve ser versionado nesse documento antes de chegar ao front.

## Regras de Aprovação {#approval-flow}

- `publisher.approvalNeeded = true` indica que o publicador ainda precisa de validação de um ancião.
- `meetingPart.requiresApprovalByElder = true` força toda designação daquela parte a iniciar como `PENDING_APPROVAL`.
- `meetingPart.allowsPendingApproval` controla se um publicador com `approvalNeeded` pode ser designado. Se `false`, o filtro rejeita o candidato antes mesmo da aprovação.

> Só anciãos (RBAC via `authorityLevel = 'ELDER'`) devem alterar `approvalStatus` posterior.

## Etiquetas de Parte (EBC) {#part-tags}

- `meetingPart.specialTag` aceita valores como `"EBC_DIRIGENTE"` ou `"EBC_LEITOR"`.
- As tags substituem detecção textual em `partType` para aprovações específicas (`isApprovedForEBC_Dirigente` e `isApprovedForEBC_Leitor`).
- Se o campo vier vazio, aplica-se apenas a lógica padrão de privilégios e gênero.

## Requisitos para Ajudantes {#helper-rules}

- `publisher.canBeHelper = false` impede o uso como ajudante, mesmo que passe pelos demais filtros.
- `meetingPart.helperRequirements` permite especificar gênero e privilégios exclusivos para o ajudante; se omitido, herda do titular.
- Ao faltar ajudante elegível, a API retorna a parte somente com o titular e registra o alerta no log — a UI deve sinalizar o buraco na pauta.

## Grupos de Cooldown {#cooldown-groups}

- `meetingPart.cooldownGroup` define famílias de partes que compartilham a mesma janela de 56 dias.
- O `RankingEngine` primeiro tenta casar `cooldownGroup`; se ausente, usa `partType` como chave de comparação.
- Utilize strings simples (ex.: `"TESOUROS_DISCURSO"`) para manter consistência entre semanas.
- `assignmentHistory.cooldownGroup` deve repetir o valor usado no momento da designação para que o histórico reflita o mesmo grupo.

## Mapeamento sugerido no Firestore

| Coleção | Chave | Campos relevantes | Observações |
|---------|------|-------------------|-------------|
| `publishers` | `publisherId` | campos de `Publisher` + timestamps (`createdAt`, `updatedAt`) | Flags de aprovação (ex.: `isApprovedForTreasures`) devem ser sincronizadas por anciãos via painel seguro. |
| `meetingParts` | `partId` | campos de `MeetingPart` + `weekTemplateId` | Pautas semanais podem ser clonadas a partir de templates oficiais. |
| `assignmentHistory` | `historyId` | campos de `AssignmentHistory` + `congregationId` | Armazena apenas 12 semanas para manter custo baixo. |
| `meetingWeeks/{weekId}/assignments` | auto-ID | campos de `Assignment` + `meetingDate` | Resultado do motor; serve para fluxo de aprovação e impressão. |

### Notas de persistência

- `authorityLevel` deverá ser preenchido pelo backend após autenticação Firebase Auth; o front não deve permitir edição manual.
- `unavailableWeeks` pode ser mantido em subcoleção (`publishers/{id}/availability`) caso precise de históricos mais longos, mas o contrato JSON continuará recebendo somente as próximas semanas relevantes.
- Para exportação, basta serializar o array `assignments` retornado pelo endpoint; nenhum dado adicional precisa ser calculado na UI.
- `meetingPart.duration` é obrigatório para que o `TimingCalculator` mantenha os horários em sincronia. Caso não seja conhecido, informe um valor aproximado e ajuste posteriormente.
