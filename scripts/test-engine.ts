import { AssignmentEngine } from '../src/core/AssignmentEngine';
import { MOCK_MEETING_WEEK, MOCK_PUBLISHERS, MOCK_HISTORY } from '../src/mocks/mockData';
import { Publisher, MeetingPart } from '../src/types/models';

// Helper para exibir nomes
const getPublisherName = (id?: string) => {
  if (!id) return '---';
  const pub = MOCK_PUBLISHERS.find(p => p.publisherId === id);
  return pub ? pub.name : 'Desconhecido';
};

console.log('=== INICIANDO TESTE DO MOTOR DE DESIGNAÇÃO ===');
console.log(`Publicadores: ${MOCK_PUBLISHERS.length}`);
console.log(`Partes na Pauta: ${MOCK_MEETING_WEEK.length}`);
console.log('------------------------------------------------');

// Executa o motor
const { assignments, warnings } = AssignmentEngine.generateAssignments(
  MOCK_MEETING_WEEK,
  MOCK_PUBLISHERS,
  MOCK_HISTORY,
  '2025-12-01'
);

console.log('\n=== RESULTADO DA PAUTA ===\n');

assignments.forEach(assignment => {
  const part = MOCK_MEETING_WEEK.find(p => p.partId === assignment.meetingPartId);
  if (!part) return;

  console.log(`[${assignment.startTime} - ${assignment.endTime}] ${part.partType.toUpperCase()}`);
  console.log(`   Titular: ${getPublisherName(assignment.principalPublisherId)}`);
  
  if (part.requiresHelper) {
    console.log(`   Ajudante: ${getPublisherName(assignment.secondaryPublisherId)}`);
  }

  console.log(`   Status: ${assignment.approvalStatus}`);
  
  if (assignment.approvalStatus === 'PENDING_APPROVAL') {
    console.log('   ⚠️  REQUER APROVAÇÃO DE ANCIÃO');
  }
  
  console.log('');
});

console.log('=== FIM DO TESTE ===');

if (warnings.length > 0) {
  console.log('\n=== ALERTAS GERADOS ===');
  warnings.forEach(warning => {
    console.log(`- [${warning.type}] Parte ${warning.meetingPartId}: ${warning.message}`);
  });
}
