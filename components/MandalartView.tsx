import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, RefreshCcw } from 'lucide-react';
import { MandalartData } from '../types';
import { GridCell } from './GridCell';

interface MandalartViewProps {
  data: MandalartData;
  onReset: () => void;
}

export const MandalartView: React.FC<MandalartViewProps> = ({ data, onReset }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (printRef.current) {
      try {
        const canvas = await html2canvas(printRef.current, {
          scale: 3, // Higher resolution
          backgroundColor: "#f8fafc", // Match the page bg color or white
          useCORS: true,
          logging: false,
          onclone: (clonedDoc) => {
            const element = clonedDoc.getElementById('mandalart-print-area');
            if (element) {
              element.style.boxShadow = 'none';
              element.style.padding = '40px';
              // Ensure background pattern renders if desired, or set to white
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

  /**
   * Layout Strategy:
   * 9 Blocks separated by a larger gap.
   * Each Block is a 3x3 grid separated by a 1px gap (creating the border effect).
   */
  
  const getZoneContentIndex = (zoneIndex: number): number | 'CENTER' => {
    if (zoneIndex === 4) return 'CENTER';
    return zoneIndex < 4 ? zoneIndex : zoneIndex - 1;
  };

  const renderZone = (zoneIndex: number) => {
    const contentIndex = getZoneContentIndex(zoneIndex);
    const isCenterZone = contentIndex === 'CENTER';

    // The container for a 3x3 block. 
    // bg-slate-200 + gap-px creates the thin border lines between cells.
    const gridContainerClass = "grid grid-cols-3 grid-rows-3 w-full h-full gap-px bg-slate-200 border border-slate-200 overflow-hidden rounded-lg shadow-sm";

    if (isCenterZone) {
      // Center Zone: Contains Main Goal + 8 Sub Goals
      return (
        <div key={zoneIndex} className={`${gridContainerClass} ring-4 ring-indigo-50`}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIndex) => {
             if (cellIndex === 4) {
               return <GridCell key={cellIndex} text={data.mainGoal} type="main" />;
             }
             const subGoalIdx = cellIndex < 4 ? cellIndex : cellIndex - 1;
             return <GridCell key={cellIndex} text={data.subGoals[subGoalIdx].title} type="sub-main" />;
          })}
        </div>
      );
    }

    // Outer Zones: Contains Sub Goal Title + 8 Tasks
    const subGoal = data.subGoals[contentIndex];
    return (
      <div key={zoneIndex} className={gridContainerClass}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIndex) => {
          if (cellIndex === 4) {
             // Center of an outer zone is the Sub-Goal Title
             return <GridCell key={cellIndex} text={subGoal.title} type="sub-main" />;
          }
          const taskIdx = cellIndex < 4 ? cellIndex : cellIndex - 1;
          return <GridCell key={cellIndex} text={subGoal.tasks[taskIdx]} type="task" />;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[1200px] animate-fade-in pb-12">
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
         
         {/* The 9x9 Master Grid */}
         {/* Using gap-3 or gap-4 creates separation between the 9 distinct blocks */}
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
    </div>
  );
};