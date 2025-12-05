import { useMemo, useState, useEffect, useCallback } from 'react';
import { AssignmentEngine } from './core/AssignmentEngine';
import { MOCK_HISTORY, MOCK_MEETING_WEEK, MOCK_PUBLISHERS } from './mocks/mockData';
import { Calendar, CheckCircle2, AlertCircle, AlertTriangle, Clock, User, Users, RefreshCw, ChevronRight, ChevronLeft, Printer, Check, ArrowLeft, Download, FileDown, ShieldCheck, XCircle } from 'lucide-react';
import { Assignment, AssignmentHistory, AssignmentWarning, GenerateAssignmentsResponse, MeetingPart, Publisher } from './types/models';
import { PublisherDetailsModal } from './components/PublisherDetailsModal';
import { PublisherSelectionModal } from './components/PublisherSelectionModal';
import { PrintLayout } from './components/PrintLayout';
import { ElderApprovalPanel } from './components/ElderApprovalPanel';
import { toCanvas } from 'html-to-image';
import jsPDF from 'jspdf';

const ASSIGNMENTS_API_URL = import.meta.env.VITE_ASSIGNMENTS_API ?? 'http://127.0.0.1:3333/api/generateAssignments';

const deriveApiBase = () => {
  try {
    const url = new URL(ASSIGNMENTS_API_URL);
    const segments = url.pathname.split('/');
    segments.pop();
    const basePath = segments.join('/') || '';
    return `${url.origin}${basePath.endsWith('/') ? basePath.slice(0, -1) : basePath}`;
  } catch {
    return 'http://127.0.0.1:3333/api';
  }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? deriveApiBase();

interface MeetingDataResponse {
  meetingDate?: string;
  parts: MeetingPart[];
  publishers: Publisher[];
  history: AssignmentHistory[];
}

interface AssignmentApprovalRecord {
  assignmentId?: string;
  meetingPartId: string;
  meetingDate: string;
  status: Assignment['approvalStatus'];
  approvedByElderId?: string;
  updatedAt: string;
}

interface AssignmentApprovalsResponse {
  records: AssignmentApprovalRecord[];
}

function App() {
  console.log('App component rendering...');
  const [meetingDate, setMeetingDate] = useState('2025-12-01');
  const [version, setVersion] = useState(0);

  const [meetingParts, setMeetingParts] = useState<MeetingPart[]>(MOCK_MEETING_WEEK);
  const [publishers, setPublishers] = useState<Publisher[]>(MOCK_PUBLISHERS);
  const [history, setHistory] = useState<AssignmentHistory[]>(MOCK_HISTORY);
  const [isDatasetLoaded, setIsDatasetLoaded] = useState(false);
  const [approvalRecords, setApprovalRecords] = useState<Record<string, Assignment['approvalStatus']>>({});

  // State for assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [warnings, setWarnings] = useState<AssignmentWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State for selection
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  
  // State for Print Preview Mode
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [isElderMode, setIsElderMode] = useState(false);

  const getApprovalKey = useCallback((partId: string) => `${meetingDate}::${partId}`, [meetingDate]);

  // Derived state: check if all assignments are approved
  const isWeekApproved = useMemo(() => {
    return assignments.length > 0 && assignments.every(a => a.approvalStatus === 'APPROVED');
  }, [assignments, meetingParts]);

  const hasBlockingWarnings = useMemo(() => {
    return warnings.some(warning => warning.type !== 'API_FALLBACK');
  }, [warnings]);

  const hasPendingStatuses = useMemo(() => {
    return assignments.some(assignment => assignment.approvalStatus === 'PENDING_APPROVAL' || assignment.approvalStatus === 'REJECTED');
  }, [assignments]);

  const canApproveAll = useMemo(() => {
    if (assignments.length === 0) return false;
    if (hasBlockingWarnings) return false;
    if (hasPendingStatuses) return false;
    return !isWeekApproved;
  }, [assignments.length, hasBlockingWarnings, hasPendingStatuses, isWeekApproved]);

  const approvalBlockReason = useMemo(() => {
    if (assignments.length === 0) return 'Nenhuma designação gerada para esta semana.';
    if (hasBlockingWarnings) return 'Resolva alertas críticos antes de aprovar.';
    if (hasPendingStatuses) return 'Existem partes pendentes ou rejeitadas.';
    return '';
  }, [assignments.length, hasBlockingWarnings, hasPendingStatuses]);

  const warningsByPartId = useMemo(() => {
    return warnings.reduce<Record<string, AssignmentWarning[]>>((acc, warning) => {
      if (warning.meetingPartId) {
        if (!acc[warning.meetingPartId]) {
          acc[warning.meetingPartId] = [];
        }
        acc[warning.meetingPartId].push(warning);
      }
      return acc;
    }, {});
  }, [warnings]);

  const assignmentsByPartId = useMemo(() => {
    return assignments.reduce<Record<string, Assignment>>((acc, assignment) => {
      acc[assignment.meetingPartId] = assignment;
      return acc;
    }, {});
  }, [assignments]);

  // Carrega pauta/publishers/histórico a partir da API mock (simulando Firestore)
  useEffect(() => {
    let isMounted = true;

    const loadDataset = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/meetingData`);
        if (!response.ok) {
          throw new Error(`API de dataset retornou status ${response.status}`);
        }
        const data: MeetingDataResponse = await response.json();
        if (!isMounted) return;
        if (data.parts?.length) setMeetingParts(data.parts);
        if (data.publishers?.length) setPublishers(data.publishers);
        if (data.history?.length) setHistory(data.history);
        if (data.meetingDate) setMeetingDate(data.meetingDate);
      } catch (datasetError) {
        console.warn('[App] Falha ao carregar dataset remoto. Mantendo mocks locais.', datasetError);
      } finally {
        if (isMounted) {
          setIsDatasetLoaded(true);
        }
      }
    };

    loadDataset();

    return () => {
      isMounted = false;
    };
  }, []);

  // Busca aprovações persistidas para a semana corrente
  useEffect(() => {
    if (!isDatasetLoaded) return;
    let isMounted = true;

    const fetchApprovals = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/assignmentApprovals?meetingDate=${meetingDate}`);
        if (!response.ok) {
          throw new Error(`API de aprovações retornou status ${response.status}`);
        }
        const data: AssignmentApprovalsResponse = await response.json();
        if (!isMounted) return;
        const nextRecords = (data.records ?? []).reduce<Record<string, Assignment['approvalStatus']>>((acc, record) => {
          acc[getApprovalKey(record.meetingPartId)] = record.status;
          return acc;
        }, {});
        setApprovalRecords(nextRecords);
      } catch (approvalError) {
        console.warn('[App] Falha ao carregar aprovações persistidas.', approvalError);
        if (isMounted) {
          setApprovalRecords({});
        }
      }
    };

    fetchApprovals();

    return () => {
      isMounted = false;
    };
  }, [meetingDate, isDatasetLoaded, getApprovalKey]);

  // Reaplica aprovações persistidas sobre as designações atuais
  useEffect(() => {
    setAssignments(prev => prev.map(assignment => {
      const persistedStatus = approvalRecords[getApprovalKey(assignment.meetingPartId)];
      if (persistedStatus && assignment.approvalStatus !== persistedStatus) {
        return { ...assignment, approvalStatus: persistedStatus };
      }
      return assignment;
    }));
  }, [approvalRecords, getApprovalKey]);

  // Generate assignments when date or version changes
  useEffect(() => {
    if (!isDatasetLoaded) return;
    let isMounted = true;
    const controller = new AbortController();

    const payload = {
      meetingDate,
      parts: meetingParts,
      publishers,
      history
    };

    const fetchAssignments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(ASSIGNMENTS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`API retornou status ${response.status}`);
        }

        const data: GenerateAssignmentsResponse = await response.json();
        if (!isMounted) return;
        setAssignments(data.assignments);
        setWarnings(data.warnings ?? []);
      } catch (apiError) {
        console.error('[App] Falha ao chamar API. Recuando para motor local.', apiError);
        if (!isMounted) return;
        try {
          const fallbackResult = AssignmentEngine.generateAssignments(
            payload.parts,
            payload.publishers,
            payload.history,
            meetingDate
          );
          setAssignments(fallbackResult.assignments);
          setWarnings([
            ...fallbackResult.warnings,
            {
              type: 'API_FALLBACK',
              message: 'API indisponível. Dados exibidos a partir do motor local.'
            }
          ]);
          setError('API indisponível. Exibindo dados do motor local.');
        } catch (localError) {
          console.error('[App] Falha no motor local', localError);
          setAssignments([]);
          setWarnings([]);
          setError(localError instanceof Error ? localError.message : String(localError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAssignments();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [meetingDate, version, meetingParts, publishers, history, isDatasetLoaded]);

  const persistApprovalStatus = async (
    payload: { assignmentId?: string; meetingPartId: string; status: Assignment['approvalStatus']; approvedByElderId?: string }
  ) => {
    try {
      await fetch(`${API_BASE_URL}/assignmentApprovals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, meetingDate })
      });
    } catch (persistError) {
      console.error('[App] Não foi possível persistir a aprovação individual.', persistError);
    }
  };

  const persistBulkApprovalStatus = async (
    updates: Array<{ assignmentId?: string; meetingPartId: string; status: Assignment['approvalStatus']; approvedByElderId?: string }>
  ) => {
    if (updates.length === 0) return;
    try {
      await fetch(`${API_BASE_URL}/assignmentApprovals/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate, updates })
      });
    } catch (persistError) {
      console.error('[App] Não foi possível persistir aprovações em lote.', persistError);
    }
  };

  const handleApproveWeek = () => {
    let snapshot: Assignment[] = [];
    setAssignments(prev => {
      const updated: Assignment[] = prev.map(a => ({
        ...a,
        approvalStatus: 'APPROVED' as Assignment['approvalStatus']
      }));
      snapshot = updated;
      return updated;
    });

    setApprovalRecords(prev => {
      const next = { ...prev };
      snapshot.forEach(assignment => {
        next[getApprovalKey(assignment.meetingPartId)] = 'APPROVED';
      });
      return next;
    });

    persistBulkApprovalStatus(
      snapshot.map(assignment => ({
        assignmentId: assignment.assignmentId,
        meetingPartId: assignment.meetingPartId,
        status: 'APPROVED'
      }))
    );
  };

  const handleAssignmentStatus = (
    assignmentId: string,
    meetingPartId: string,
    status: 'APPROVED' | 'REJECTED' | 'PENDING_APPROVAL' | 'DRAFT'
  ) => {
    setAssignments(prev => prev.map(assignment => assignment.assignmentId === assignmentId ? { ...assignment, approvalStatus: status } : assignment));
    setApprovalRecords(prev => ({
      ...prev,
      [getApprovalKey(meetingPartId)]: status
    }));
    persistApprovalStatus({ assignmentId, meetingPartId, status });
  };

  const handlePrint = () => {
    setIsPrintPreview(true);
  };

  const capturePrintLayout = async () => {
    const element = document.getElementById('print-layout-container');
    if (!element) throw new Error('Layout de impressão não encontrado.');

    await new Promise(resolve => setTimeout(resolve, 100));

    const pixelRatio = Math.min(2, window.devicePixelRatio || 2);

    return toCanvas(element, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#ffffff',
      style: {
        backgroundColor: '#ffffff'
      }
    });
  };

  const handleSaveImage = async () => {
    try {
      const canvas = await capturePrintLayout();
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `designacoes-${meetingDate}.png`;
      link.click();
    } catch (err) {
      console.error('Erro ao salvar imagem:', err);
      alert(`Erro ao salvar imagem: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSavePdf = async () => {
    try {
      const canvas = await capturePrintLayout();
      const image = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(image, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(image, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      pdf.save(`designacoes-${meetingDate}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert(`Erro ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const focusAssignmentCard = (assignmentId: string) => {
    const element = document.getElementById(`assignment-card-${assignmentId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('animate-pulse');
    window.setTimeout(() => {
      element.classList.remove('animate-pulse');
    }, 1200);
  };

  const selectedPublisher = useMemo(() =>
    publishers.find(p => p.publisherId === selectedPublisherId) || null
  , [publishers, selectedPublisherId]);

  const handlePublisherClick = (publisherId: string, assignmentId: string) => {
    setSelectedPublisherId(publisherId);
    setSelectedAssignmentId(assignmentId);
  };

  const handleReplaceClick = () => {
    setIsSelectionModalOpen(true);
  };

  const handlePublisherSelect = (newPublisherId: string) => {
    if (!selectedAssignmentId) return;

    setAssignments(prev => prev.map(assignment => {
      if (assignment.assignmentId === selectedAssignmentId) {
        if (assignment.principalPublisherId === selectedPublisherId) {
          return { ...assignment, principalPublisherId: newPublisherId };
        }
        if (assignment.secondaryPublisherId === selectedPublisherId) {
          return { ...assignment, secondaryPublisherId: newPublisherId };
        }
      }
      return assignment;
    }));

    setIsSelectionModalOpen(false);
    setSelectedPublisherId(null);
    setSelectedAssignmentId(null);
  };

  const changeWeek = (weeks: number) => {
    const d = new Date(meetingDate);
    d.setDate(d.getDate() + (weeks * 7));
    setMeetingDate(d.toISOString().split('T')[0]);
  };

  const getPublisherName = (id?: string) => {
    if (!id) return '---';
    const pub = publishers.find(p => p.publisherId === id);
    return pub ? pub.name : 'Desconhecido';
  };

  const getPart = (id: string) => meetingParts.find(p => p.partId === id);

  const sections = [
    { key: 'TESOUROS', title: 'Tesouros da Palavra de Deus', color: 'bg-gray-700', textColor: 'text-white' },
    { key: 'MINISTERIO', title: 'Faça Seu Melhor no Ministério', color: 'bg-yellow-600', textColor: 'text-white' },
    { key: 'VIDA_CRISTA', title: 'Nossa Vida Cristã', color: 'bg-red-700', textColor: 'text-white' },
  ];

  const assignmentsBySection = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {};
    assignments.forEach(a => {
      const part = getPart(a.meetingPartId);
      const section = part?.section || 'OUTROS';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(a);
    });
    return grouped;
  }, [assignments, meetingParts]);

  if (isPrintPreview) {
    return (
      <div className="min-h-screen bg-gray-500 p-8 flex flex-col items-center print:p-0 print:bg-white">
        <div className="mb-6 flex gap-4 print:hidden w-full max-w-[210mm]">
          <button 
            onClick={() => setIsPrintPreview(false)}
            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors shadow-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="flex-1"></div>
          
          <button 
            onClick={handleSavePdf}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors shadow-sm font-medium"
          >
            <FileDown className="w-4 h-4" />
            Salvar PDF
          </button>

          <button 
            onClick={handleSaveImage}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Salvar Imagem
          </button>

          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
        
        <div id="print-layout-container" className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] print:shadow-none print:w-full print:max-w-none">
          <PrintLayout 
            meetingDate={meetingDate}
            assignments={assignments}
            publishers={publishers}
            meetingParts={meetingParts}
            warnings={warnings}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-900 print:hidden">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Designações RVM</h1>
              <p className="text-gray-500">Gerenciamento automático de partes da reunião</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsElderMode(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors shadow-sm ${isElderMode ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                <ShieldCheck className="w-4 h-4" />
                {isElderMode ? 'Modo Ancião Ativo' : 'Entrar como Ancião'}
              </button>
              <button 
                onClick={() => setVersion(v => v + 1)}
                className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors shadow-sm disabled:opacity-60"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Gerando...' : 'Regerar'}
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-700">Semana de:</span>
                <input 
                  type="date" 
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-gray-900 font-bold"
                  aria-label="Selecionar semana"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => changeWeek(-1)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                  aria-label="Semana anterior"
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => changeWeek(1)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                  aria-label="Próxima semana"
                  title="Próxima semana"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-4">
                {isWeekApproved ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Semana Aprovada
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={handleApproveWeek}
                    disabled={!canApproveAll}
                    aria-disabled={!canApproveAll}
                    title={canApproveAll ? 'Enviar para aprovação' : approvalBlockReason || 'Ação bloqueada'}
                    className={`flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${canApproveAll ? 'hover:bg-blue-100' : 'opacity-60 cursor-not-allowed'}`}
                  >
                    <Check className="w-4 h-4" />
                    Aprovar Semana
                  </button>
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Gerando na API…
                  </div>
                )}
              </div>
              {!isWeekApproved && !canApproveAll && approvalBlockReason && (
                <p className="text-xs text-red-600 text-right max-w-xs">{approvalBlockReason}</p>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-800">Erro na Geração</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900">Alertas de Designação</h3>
                  <ul className="mt-2 text-amber-900 text-sm space-y-2">
                    {warnings.map((warning) => {
                      const part = warning.meetingPartId ? getPart(warning.meetingPartId) : null;
                      const linkedAssignment = warning.meetingPartId ? assignmentsByPartId[warning.meetingPartId] : null;
                      const principalName = linkedAssignment ? getPublisherName(linkedAssignment.principalPublisherId) : null;
                      const helperName = linkedAssignment?.secondaryPublisherId ? getPublisherName(linkedAssignment.secondaryPublisherId) : null;
                      const assignmentId = linkedAssignment?.assignmentId;
                      return (
                        <li
                          key={`${warning.meetingPartId ?? 'global'}-${warning.type}-${warning.message}`}
                          className="bg-white/60 rounded-xl px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <div>
                            <p>
                              <span className="font-semibold">{part?.partType ?? 'Parte não identificada'}:</span> {warning.message}
                            </p>
                            {principalName && (
                              <p className="text-xs text-amber-800">
                                Titular: <span className="font-semibold">{principalName}</span>
                                {helperName && ` · Ajudante: ${helperName}`}
                              </p>
                            )}
                          </div>
                          {assignmentId ? (
                            <button
                              type="button"
                              onClick={() => focusAssignmentCard(assignmentId)}
                              className="self-start sm:self-auto text-xs font-semibold text-amber-800 border border-amber-300 px-3 py-1 rounded-full hover:bg-amber-100 transition-colors"
                            >
                              Ver parte
                            </button>
                          ) : (
                            <span className="text-xs text-amber-700 italic">Sem designação gerada</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {sections.map(section => {
                const sectionAssignments = assignmentsBySection[section.key] || [];
                const sectionMissingParts = meetingParts.filter(part => part.section === section.key && warningsByPartId[part.partId] && !assignmentsByPartId[part.partId]);
                if (sectionAssignments.length === 0 && sectionMissingParts.length === 0) return null;

                return (
                  <div key={section.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className={`${section.color} px-6 py-3 flex items-center gap-3`}>
                      <div className="p-1.5 bg-white/20 rounded-lg">
                        <Clock className={`w-5 h-5 ${section.textColor}`} />
                      </div>
                      <h2 className={`text-lg font-bold ${section.textColor}`}>{section.title}</h2>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {sectionAssignments.map((assignment) => {
                        const part = getPart(assignment.meetingPartId);
                        if (!part) return null;

                        const isPrincipalSelected = selectedAssignmentId === assignment.assignmentId && selectedPublisherId === assignment.principalPublisherId;
                        const isSecondarySelected = selectedAssignmentId === assignment.assignmentId && selectedPublisherId === assignment.secondaryPublisherId;
                        const partWarnings = warningsByPartId[assignment.meetingPartId] ?? [];
                        const hasCriticalPartWarning = partWarnings.some(warning => warning.type !== 'API_FALLBACK');
                        const helperWarning = partWarnings.find(warning => warning.type === 'HELPER_MISSING');
                        const requiresHelper = Boolean(part.requiresHelper);
                        const helperMissing = requiresHelper && !assignment.secondaryPublisherId;

                        return (
                          <div
                            id={`assignment-card-${assignment.assignmentId}`}
                            key={assignment.assignmentId}
                            className={`p-4 transition-colors group ${hasCriticalPartWarning ? 'bg-amber-50/70 ring-1 ring-amber-200' : 'hover:bg-gray-50'}`}
                          >
                        <div className="flex items-start gap-4">
                          <div className="w-16 pt-1">
                            <span className="text-sm font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {assignment.startTime}
                            </span>
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900">{part.partType}</h3>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {part.duration} min
                              </span>
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${assignment.approvalStatus === 'APPROVED'
                                  ? 'bg-green-100 text-green-700'
                                  : assignment.approvalStatus === 'PENDING_APPROVAL'
                                    ? 'bg-amber-100 text-amber-700'
                                    : assignment.approvalStatus === 'REJECTED'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {assignment.approvalStatus === 'APPROVED' && 'Aprovado'}
                                {assignment.approvalStatus === 'PENDING_APPROVAL' && 'Pendente'}
                                {assignment.approvalStatus === 'REJECTED' && 'Rejeitado'}
                                {assignment.approvalStatus === 'DRAFT' && 'Rascunho'}
                              </span>
                            </div>
                            
                            <div className="flex gap-4 mt-3">
                              <div 
                                onClick={() => handlePublisherClick(assignment.principalPublisherId, assignment.assignmentId)}
                                className={`
                                  flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all flex-1
                                  ${isPrincipalSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}
                                `}
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                                  <User className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Designado</p>
                                  <p className="font-medium text-gray-900">{getPublisherName(assignment.principalPublisherId)}</p>
                                </div>
                              </div>

                              {assignment.secondaryPublisherId ? (
                                <div 
                                  onClick={() => handlePublisherClick(assignment.secondaryPublisherId!, assignment.assignmentId)}
                                  className={`
                                    flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all flex-1
                                    ${isSecondarySelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}
                                  `}
                                >
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Ajudante</p>
                                    <p className="font-medium text-gray-900">{getPublisherName(assignment.secondaryPublisherId)}</p>
                                  </div>
                                </div>
                              ) : (
                                helperMissing && (
                                  <div className="flex items-center gap-3 p-2 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 text-amber-900 flex-1">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                                      <AlertTriangle className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-amber-800 uppercase font-bold tracking-wider">Ajudante pendente</p>
                                      <p className="text-sm">
                                        {helperWarning?.message ?? 'Nenhum ajudante elegível foi encontrado para esta parte.'}
                                      </p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>

                            {partWarnings.length > 0 && (
                              <div className="mt-4 space-y-2">
                                {partWarnings.map((warning) => (
                                  <div
                                    key={`${assignment.assignmentId}-${warning.type}-${warning.message}`}
                                    className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg"
                                  >
                                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                                    <p>{warning.message}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {isElderMode && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => handleAssignmentStatus(assignment.assignmentId, assignment.meetingPartId, 'APPROVED')}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                              disabled={assignment.approvalStatus === 'APPROVED'}
                            >
                              <Check className="w-3 h-3" /> Aprovar
                            </button>
                            <button
                              onClick={() => handleAssignmentStatus(assignment.assignmentId, assignment.meetingPartId, 'REJECTED')}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                              disabled={assignment.approvalStatus === 'REJECTED'}
                            >
                              <XCircle className="w-3 h-3" /> Rejeitar
                            </button>
                            {assignment.approvalStatus === 'REJECTED' && (
                              <button
                                onClick={() => handleAssignmentStatus(assignment.assignmentId, assignment.meetingPartId, 'DRAFT')}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                Reabrir
                              </button>
                            )}
                            {assignment.approvalStatus === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => handleAssignmentStatus(assignment.assignmentId, assignment.meetingPartId, 'DRAFT')}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                Retornar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                      {sectionMissingParts.map(part => {
                        const partWarnings = warningsByPartId[part.partId] ?? [];
                        return (
                          <div
                            key={`missing-${part.partId}`}
                            className="p-4 bg-amber-50/70 border-t border-amber-200"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-16 pt-1">
                                <span className="text-sm font-mono font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                                  --:--
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-bold text-amber-900">{part.partType}</h3>
                                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {part.duration} min
                                  </span>
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                                    Sem designação
                                  </span>
                                </div>
                                <div className="flex gap-4 mt-3">
                                  <div className="flex items-center gap-3 p-2 rounded-lg border-2 border-dashed border-amber-300 bg-white flex-1 text-amber-800">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                                      <AlertTriangle className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="text-xs uppercase font-bold tracking-wider">Titular pendente</p>
                                      <p className="text-sm">Nenhum candidato elegível foi encontrado.</p>
                                    </div>
                                  </div>
                                  {part.requiresHelper && (
                                    <div className="flex items-center gap-3 p-2 rounded-lg border-2 border-dashed border-amber-300 bg-white flex-1 text-amber-800">
                                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                                        <AlertTriangle className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="text-xs uppercase font-bold tracking-wider">Ajudante pendente</p>
                                        <p className="text-sm">Selecione um ajudante assim que houver titular.</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {partWarnings.length > 0 && (
                                  <div className="mt-4 space-y-2">
                                    {partWarnings.map((warning) => (
                                      <div
                                        key={`missing-${part.partId}-${warning.type}-${warning.message}`}
                                        className="flex items-start gap-2 text-xs text-amber-900 bg-white border border-amber-200 px-3 py-2 rounded-lg"
                                      >
                                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                                        <p>{warning.message}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
            );
          })}
            </div>
          </div>

          {isElderMode && (
            <ElderApprovalPanel
              assignments={assignments}
              meetingParts={meetingParts}
              publishers={publishers}
              onUpdateStatus={handleAssignmentStatus}
              isWeekApproved={isWeekApproved}
              onApproveAll={handleApproveWeek}
              onFocusAssignment={focusAssignmentCard}
              canApproveAll={canApproveAll}
              approvalBlockReason={approvalBlockReason}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedPublisher && (
        <PublisherDetailsModal 
          publisher={selectedPublisher} 
          history={history}
          onClose={() => setSelectedPublisherId(null)}
          onReplace={handleReplaceClick}
        />
      )}

      {isSelectionModalOpen && (
        <PublisherSelectionModal
          publishers={publishers}
          onSelect={handlePublisherSelect}
          onClose={() => setIsSelectionModalOpen(false)}
          currentPublisherId={selectedPublisherId || undefined}
        />
      )}
    </div>
  );
}

export default App;