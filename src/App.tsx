import { useMemo, useState, useEffect } from 'react';
import { AssignmentEngine } from './core/AssignmentEngine';
import { MOCK_HISTORY, MOCK_MEETING_WEEK, MOCK_PUBLISHERS } from './mocks/mockData';
import { Calendar, CheckCircle2, AlertCircle, Clock, User, Users, RefreshCw, ChevronRight, ChevronLeft, Printer, Check, ArrowLeft, Download } from 'lucide-react';
import { Assignment } from './types/models';
import { PublisherDetailsModal } from './components/PublisherDetailsModal';
import { PublisherSelectionModal } from './components/PublisherSelectionModal';
import { PrintLayout } from './components/PrintLayout';
import html2canvas from 'html2canvas';

function App() {
  console.log('App component rendering...');
  const [meetingDate, setMeetingDate] = useState('2025-12-01');
  const [version, setVersion] = useState(0);

  // State for assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // State for selection
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  
  // State for Print Preview Mode
  const [isPrintPreview, setIsPrintPreview] = useState(false);

  // Derived state: check if all assignments are approved
  const isWeekApproved = useMemo(() => {
    return assignments.length > 0 && assignments.every(a => a.approvalStatus === 'APPROVED');
  }, [assignments]);

  // Generate assignments when date or version changes
  useEffect(() => {
    console.log('Generating assignments for date:', meetingDate);
    try {
      const newAssignments = AssignmentEngine.generateAssignments(
        MOCK_MEETING_WEEK,
        MOCK_PUBLISHERS,
        MOCK_HISTORY,
        meetingDate
      );
      console.log('Assignments generated:', newAssignments.length);
      setAssignments(newAssignments);
      setError(null);
    } catch (error) {
      console.error("Erro ao gerar designações:", error);
      setError(error instanceof Error ? error.message : String(error));
      setAssignments([]);
    }
  }, [meetingDate, version]);

  const handleApproveWeek = () => {
    setAssignments(prev => prev.map(a => ({
      ...a,
      approvalStatus: 'APPROVED'
    })));
  };

  const handlePrint = () => {
    setIsPrintPreview(true);
  };

  const handleSaveImage = async () => {
    const element = document.getElementById('print-layout-container');
    if (!element) return;

    try {
      // Aguarda um momento para garantir que tudo foi renderizado
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: true, // Enable logging to see more details in console
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `designacoes-${meetingDate}.png`;
      link.click();
    } catch (err) {
      console.error("Erro ao salvar imagem:", err);
      alert(`Erro ao salvar imagem: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const selectedPublisher = useMemo(() =>
    MOCK_PUBLISHERS.find(p => p.publisherId === selectedPublisherId) || null
  , [selectedPublisherId]);

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
    const pub = MOCK_PUBLISHERS.find(p => p.publisherId === id);
    return pub ? pub.name : 'Desconhecido';
  };

  const getPart = (id: string) => MOCK_MEETING_WEEK.find(p => p.partId === id);

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
  }, [assignments]);

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
            publishers={MOCK_PUBLISHERS}
            meetingParts={MOCK_MEETING_WEEK}
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
                onClick={() => setVersion(v => v + 1)}
                className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Regerar
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
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => changeWeek(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isWeekApproved ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Semana Aprovada
                </div>
              ) : (
                <button 
                  onClick={handleApproveWeek}
                  className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aprovar Semana
                </button>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800">Erro na Geração</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {sections.map(section => {
            const sectionAssignments = assignmentsBySection[section.key] || [];
            if (sectionAssignments.length === 0) return null;

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

                    return (
                      <div key={assignment.assignmentId} className="p-4 hover:bg-gray-50 transition-colors group">
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

                              {assignment.secondaryPublisherId && (
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
                              )}
                            </div>
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

      {/* Modals */}
      {selectedPublisher && (
        <PublisherDetailsModal 
          publisher={selectedPublisher} 
          history={MOCK_HISTORY}
          onClose={() => setSelectedPublisherId(null)}
          onReplace={handleReplaceClick}
        />
      )}

      {isSelectionModalOpen && (
        <PublisherSelectionModal
          publishers={MOCK_PUBLISHERS}
          onSelect={handlePublisherSelect}
          onClose={() => setIsSelectionModalOpen(false)}
          currentPublisherId={selectedPublisherId || undefined}
        />
      )}
    </div>
  );
}

export default App;