import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, RefreshCcw, X, Info, CheckCircle2, TrendingUp, Lightbulb } from 'lucide-react';
import { MandalartData, SubGoal } from '../types';
import { GridCell } from './GridCell';

interface MandalartViewProps {
  data: MandalartData;
  onReset: () => void;
}

export const MandalartView: React.FC<MandalartViewProps> = ({ data, onReset }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedSubGoal, setSelectedSubGoal] = useState<SubGoal | null>(null);

  const handleDownload = async () => {
    if (printRef.current) {
      try {
        const canvas = await html2canvas(printRef.current, {
          scale: 3,
          backgroundColor: "#f8fafc",
          useCORS: true,
          logging: false,
          onclone: (clonedDoc) => {
            const element = clonedDoc.getElementById('mandalart-print-area');
            if (element) {
              element.style.boxShadow = 'none';
              element.style.padding = '40px';
              element.style.background = '#ffffff'; 
            }
          }
        });

        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `mandalart-${data.mainGoal.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.click();
      } catch (err) {
        console.error("Export failed:", err);
        alert("Não foi possível gerar a imagem. Tente novamente.");
      }
    }
  };

  const getZoneContentIndex = (zoneIndex: number): number | 'CENTER' => {
    if (zoneIndex === 4) return 'CENTER';
    return zoneIndex < 4 ? zoneIndex : zoneIndex - 1;
  };

  const renderZone = (zoneIndex: number) => {
    const contentIndex = getZoneContentIndex(zoneIndex);
    const isCenterZone = contentIndex === 'CENTER';

    const gridContainerClass = "grid grid-cols-3 grid-rows-3 w-full h-full gap-px bg-slate-200 border border-slate-200 overflow-hidden rounded-lg shadow-sm";

    if (isCenterZone) {
      return (
        <div key={zoneIndex} className={`${gridContainerClass} ring-4 ring-indigo-50`}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIndex) => {
             if (cellIndex === 4) {
               return <GridCell key={cellIndex} text={data.mainGoal} type="main" />;
             }
             const subGoalIdx = cellIndex < 4 ? cellIndex : cellIndex - 1;
             const subGoal = data.subGoals[subGoalIdx];
             return (
               <GridCell 
                 key={cellIndex} 
                 text={subGoal.title} 
                 type="sub-main" 
                 onClick={() => setSelectedSubGoal(subGoal)}
               />
             );
          })}
        </div>
      );
    }

    const subGoal = data.subGoals[contentIndex];
    return (
      <div key={zoneIndex} className={gridContainerClass}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIndex) => {
          if (cellIndex === 4) {
             return (
               <GridCell 
                 key={cellIndex} 
                 text={subGoal.title} 
                 type="sub-main" 
                 onClick={() => setSelectedSubGoal(subGoal)}
               />
             );
          }
          const taskIdx = cellIndex < 4 ? cellIndex : cellIndex - 1;
          return <GridCell key={cellIndex} text={subGoal.tasks[taskIdx]} type="task" />;
        })}
      </div>
    );
  };

  // Sheet Component Content
  const renderSheet = () => {
    if (!selectedSubGoal) return null;

    return (
      <>
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={() => setSelectedSubGoal(null)}
        />
        <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 block">Sub-Objetivo</span>
              <h2 className="text-2xl font-bold text-gray-900">{selectedSubGoal.title}</h2>
            </div>
            <button 
              onClick={() => setSelectedSubGoal(null)}
              className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Description */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <Info size={18} className="text-indigo-500" />
                <h3>O que é isso?</h3>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm bg-indigo-50/50 p-4 rounded-xl border border-indigo-50">
                {selectedSubGoal.description || "Foco em desenvolver esta área específica para alcançar o objetivo maior."}
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <CheckCircle2 size={18} className="text-green-500" />
                <h3>Checklist de Ações</h3>
              </div>
              <ul className="space-y-3">
                {selectedSubGoal.tasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-3 group cursor-default">
                    <div className="mt-0.5 w-5 h-5 rounded border-2 border-gray-200 flex-shrink-0 group-hover:border-indigo-400 transition-colors" />
                    <span className="text-sm text-gray-600">{task}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress Scale (Visual Demo) */}
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <TrendingUp size={18} className="text-blue-500" />
                <h3>Escala de Progresso</h3>
              </div>
              <div className="bg-gray-100 h-4 rounded-full overflow-hidden relative">
                 {/* Visual indicator starting at 0 */}
                 <div className="absolute top-0 left-0 h-full w-[10%] bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full" />
              </div>
              <div className="flex justify-between text-xs text-gray-400 font-medium px-1">
                <span>Iniciante</span>
                <span>Em andamento</span>
                <span>Dominado</span>
              </div>
            </div>

            {/* Suggestions/Advice */}
            <div className="space-y-3 pb-6">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <Lightbulb size={18} className="text-amber-500" />
                <h3>Como Melhorar</h3>
              </div>
               <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 leading-relaxed">
                 {selectedSubGoal.advice || "Mantenha a consistência e revise suas tarefas semanalmente."}
               </div>
            </div>

          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400">
             Clique fora para fechar
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[1200px] animate-fade-in pb-12 relative">
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition shadow-lg font-medium text-sm"
        >
          <Download size={16} />
          Salvar Imagem
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm font-medium text-sm"
        >
          <RefreshCcw size={16} />
          Novo
        </button>
      </div>

      {/* The Printable Area Wrapper */}
      <div 
        ref={printRef} 
        id="mandalart-print-area"
        className="p-4 sm:p-10 bg-white/50 backdrop-blur-sm shadow-xl border border-white/50 rounded-3xl flex flex-col items-center"
      >
         <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">{data.mainGoal}</h2>
            <p className="text-sm text-gray-500 mt-2 uppercase tracking-widest font-semibold">Plano de Ação Mandalart</p>
         </div>
         
         <div 
           className="grid grid-cols-3 gap-3 sm:gap-6 p-2" 
           style={{ 
             width: 'min(95vw, 900px)', 
             height: 'min(95vw, 900px)', 
             aspectRatio: '1/1' 
           }}
         >
           {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((zoneIndex) => renderZone(zoneIndex))}
         </div>

         <div className="w-full flex justify-between items-center mt-6 px-4">
            <div className="text-xs text-gray-400 font-medium">Mandalart.AI</div>
            <div className="text-xs text-gray-400">Gerado com Google Gemini</div>
         </div>
      </div>

      {/* Render the Sheet */}
      {renderSheet()}
    </div>
  );
};