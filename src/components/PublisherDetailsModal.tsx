import { X, Calendar, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Publisher, AssignmentHistory } from '../types/models';

interface PublisherDetailsModalProps {
  publisher: Publisher | null;
  history: AssignmentHistory[];
  onClose: () => void;
  onReplace: () => void;
}

export function PublisherDetailsModal({ publisher, history, onClose, onReplace }: PublisherDetailsModalProps) {
  if (!publisher) return null;

  // Filtrar histórico deste publicador
  const publisherHistory = history
    .filter(h => h.publisherId === publisher.publisherId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{publisher.name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {publisher.privileges.map(priv => (
                <span key={priv} className="bg-blue-500/50 px-2 py-0.5 rounded text-xs font-medium border border-blue-400/30">
                  {priv}
                </span>
              ))}
              {publisher.privileges.length === 0 && (
                <span className="bg-blue-500/50 px-2 py-0.5 rounded text-xs font-medium border border-blue-400/30">
                  Publicador
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-blue-500 rounded-full transition-colors"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Histórico Recente
          </h3>

          <div className="space-y-3">
            {publisherHistory.length > 0 ? (
              publisherHistory.map(h => (
                <div key={h.historyId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="font-medium text-gray-800">{h.partType}</p>
                    <p className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    h.assignmentType === 'TEACHING' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {h.assignmentType === 'TEACHING' ? 'Ensino' : 'Estudante'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-4 italic">Nenhuma designação recente encontrada.</p>
            )}
          </div>

          {/* Status Info */}
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Disponibilidade</p>
              {publisher.unavailableWeeks.length > 0 ? (
                <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Restrições
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Total
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Aprovação</p>
              {publisher.approvalNeeded ? (
                <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Requerida
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Automática
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button 
              onClick={onReplace}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Substituir Publicador
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
