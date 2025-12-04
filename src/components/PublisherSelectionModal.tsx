import { useState, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { Publisher } from '../types/models';

interface PublisherSelectionModalProps {
  publishers: Publisher[];
  onSelect: (publisherId: string) => void;
  onClose: () => void;
  currentPublisherId?: string;
}

export function PublisherSelectionModal({ publishers, onSelect, onClose, currentPublisherId }: PublisherSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPublishers = useMemo(() => {
    return publishers.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [publishers, searchTerm]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold">Selecionar Publicador</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar publicador..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-2 space-y-1">
          {filteredPublishers.map(publisher => {
            const isSelected = publisher.publisherId === currentPublisherId;
            return (
              <button
                key={publisher.publisherId}
                onClick={() => onSelect(publisher.publisherId)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  isSelected 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {publisher.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {publisher.name}
                    </p>
                    <div className="flex gap-1">
                      {publisher.privileges.map(priv => (
                        <span key={priv} className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {priv}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {isSelected && <Check className="w-5 h-5 text-blue-600" />}
              </button>
            );
          })}
          
          {filteredPublishers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              Nenhum publicador encontrado.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
