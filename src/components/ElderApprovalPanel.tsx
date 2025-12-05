import { useMemo, useState } from 'react';
import { Assignment, MeetingPart, Publisher } from '../types/models';
import { CalendarCheck2, Eye, Filter, ShieldCheck, User, Users, XCircle, Check } from 'lucide-react';
import clsx from 'clsx';

const statusLabels = {
  PENDING_APPROVAL: { label: 'Pendente', badge: 'bg-amber-100 text-amber-700', indicator: 'border-amber-200' },
  DRAFT: { label: 'Rascunho', badge: 'bg-gray-100 text-gray-700', indicator: 'border-gray-200' },
  REJECTED: { label: 'Rejeitado', badge: 'bg-red-100 text-red-700', indicator: 'border-red-200' },
  APPROVED: { label: 'Aprovado', badge: 'bg-green-100 text-green-700', indicator: 'border-green-200' }
};

type StatusFilter = 'ALL' | 'PENDING_APPROVAL' | 'DRAFT' | 'REJECTED';

interface ElderApprovalPanelProps {
  assignments: Assignment[];
  meetingParts: MeetingPart[];
  publishers: Publisher[];
  onUpdateStatus: (assignmentId: string, meetingPartId: string, status: Assignment['approvalStatus']) => void;
  isWeekApproved: boolean;
  onApproveAll: () => void;
  onFocusAssignment: (assignmentId: string) => void;
  canApproveAll: boolean;
  approvalBlockReason: string;
}

export function ElderApprovalPanel({
  assignments,
  meetingParts,
  publishers,
  onUpdateStatus,
  isWeekApproved,
  onApproveAll,
  onFocusAssignment,
  canApproveAll,
  approvalBlockReason
}: ElderApprovalPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const stats = useMemo(() => {
    return assignments.reduce(
      (acc, assignment) => {
        acc[assignment.approvalStatus] += 1;
        return acc;
      },
      {
        PENDING_APPROVAL: 0,
        DRAFT: 0,
        REJECTED: 0,
        APPROVED: 0
      } as Record<Assignment['approvalStatus'], number>
    );
  }, [assignments]);

  const actionableAssignments = useMemo(() => {
    return assignments
      .filter((assignment) => assignment.approvalStatus !== 'APPROVED')
      .map((assignment) => {
        const part = meetingParts.find((p) => p.partId === assignment.meetingPartId);
        const primary = publishers.find((p) => p.publisherId === assignment.principalPublisherId);
        const helper = assignment.secondaryPublisherId
          ? publishers.find((p) => p.publisherId === assignment.secondaryPublisherId)
          : undefined;
        return { assignment, part, primary, helper };
      })
      .sort((a, b) => {
        const priority = ['PENDING_APPROVAL', 'DRAFT', 'REJECTED'];
        return priority.indexOf(a.assignment.approvalStatus) - priority.indexOf(b.assignment.approvalStatus);
      });
  }, [assignments, meetingParts, publishers]);

  const filteredAssignments = actionableAssignments.filter(({ assignment }) => {
    if (statusFilter === 'ALL') return true;
    return assignment.approvalStatus === statusFilter;
  });

  return (
    <aside className="lg:w-80 w-full shrink-0">
      <div className="bg-white border border-purple-100 rounded-2xl shadow-sm p-5 sticky top-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
          <div>
            <p className="text-xs uppercase text-purple-500 font-semibold tracking-wide">Modo Ancião</p>
            <h2 className="text-lg font-bold text-gray-900">Fila de Aprovação</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {(['PENDING_APPROVAL', 'DRAFT', 'REJECTED', 'APPROVED'] as const).map((status) => (
            <div key={status} className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-500">{statusLabels[status].label}</p>
              <p className="text-2xl font-bold text-gray-900">{stats[status]}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Filter className="w-4 h-4" />
          <span>Filtrar por status</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['ALL', 'PENDING_APPROVAL', 'DRAFT', 'REJECTED'] as const).map((filterValue) => {
            const label = filterValue === 'ALL' ? 'Todos' : statusLabels[filterValue].label;
            return (
              <button
                key={filterValue}
                onClick={() => setStatusFilter(filterValue)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                  statusFilter === filterValue
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'text-gray-600 border-gray-200 hover:border-purple-200'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {!isWeekApproved && (
          <div className="w-full mb-4">
            <button
              onClick={onApproveAll}
              disabled={!canApproveAll}
              title={canApproveAll ? 'Enviar todos para aprovação' : approvalBlockReason || 'Ação bloqueada'}
              className={clsx(
                'w-full text-center text-white py-2 rounded-lg text-sm font-semibold transition-colors',
                canApproveAll
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-purple-300 cursor-not-allowed'
              )}
            >
              Aprovar Todos
            </button>
            {!canApproveAll && approvalBlockReason && (
              <p className="mt-2 text-xs text-red-600 text-center">{approvalBlockReason}</p>
            )}
          </div>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {filteredAssignments.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
              Nenhuma designação pendente para este filtro.
            </div>
          ) : (
            filteredAssignments.map(({ assignment, part, primary, helper }) => {
              const statusConfig = statusLabels[assignment.approvalStatus];
              return (
                <div
                  key={assignment.assignmentId}
                  className={clsx(
                    'rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                  , statusConfig.indicator)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-gray-500 tracking-wide">
                      {part?.section ?? 'Parte'}
                    </span>
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', statusConfig.badge)}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 mb-1">{part?.partType ?? 'Parte desconhecida'}</div>
                  <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                    <CalendarCheck2 className="w-3 h-3" /> {assignment.startTime ?? '--:--'}
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-500" />
                      <span>{primary ? primary.name : 'Publicador não encontrado'}</span>
                    </div>
                    {helper && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span>{helper.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => onUpdateStatus(assignment.assignmentId, assignment.meetingPartId, 'APPROVED')}
                      className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-60"
                      disabled={assignment.approvalStatus === 'APPROVED'}
                    >
                      <Check className="w-3 h-3" /> Aprovar
                    </button>
                    <button
                      onClick={() => onUpdateStatus(assignment.assignmentId, assignment.meetingPartId, 'REJECTED')}
                      className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-60"
                      disabled={assignment.approvalStatus === 'REJECTED'}
                    >
                      <XCircle className="w-3 h-3" /> Rejeitar
                    </button>
                  </div>

                  {(assignment.approvalStatus === 'REJECTED' || assignment.approvalStatus === 'PENDING_APPROVAL') && (
                    <button
                      onClick={() => onUpdateStatus(assignment.assignmentId, assignment.meetingPartId, 'DRAFT')}
                      className="mt-2 w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Reabrir
                    </button>
                  )}

                  <button
                    onClick={() => onFocusAssignment(assignment.assignmentId)}
                    className="mt-2 w-full text-xs flex items-center justify-center gap-1 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-purple-200 hover:text-purple-600 transition-colors"
                  >
                    <Eye className="w-3 h-3" /> Ver no painel
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
