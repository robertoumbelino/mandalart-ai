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
          backgroundColor: "#ffffff",
          useCORS: true,
          // Manipulate the cloned document to ensure perfect capture without clipping
          onclone: (clonedDoc) => {
            const element = clonedDoc.getElementById('mandalart-print-area');
            if (element) {
              // Remove shadows/borders that might get clipped
              element.style.boxShadow = 'none';
              element.style.borderRadius = '0';
              element.style.padding = '20px'; // Add safe padding for export
              element.style.width = 'auto';
              element.style.height = 'auto';
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
   * The Mandalart consists of 9 zones (3x3 big grid).
   * Zone 4 (Center) is the Main Goal + 8 Sub Goals.
   * Other Zones (0-3, 5-8) are the tasks for those Sub Goals.
   */
  
  // Helper to map a flat index (0-8) of a 3x3 grid to what content it should hold
  // Returns the SubGoal index (0-7) or 'CENTER'
  const getZoneContentIndex = (zoneIndex: number): number | 'CENTER' => {
    if (zoneIndex === 4) return 'CENTER';
    return zoneIndex < 4 ? zoneIndex : zoneIndex - 1;
  };

  // Helper to render a 3x3 grid for a specific zone
  const renderZone = (zoneIndex: number) => {
    const contentIndex = getZoneContentIndex(zoneIndex);

    // If it's the Center Zone (The 'Overview' Grid)
    if (contentIndex === 'CENTER') {
      // This 3x3 grid contains the 8 Sub-Goal Titles + Main Goal in center
      return (
        <div key={zoneIndex} className="grid grid-cols-3 grid-rows-3 w-full h-full border-2 border-gray-800">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIndex) => {
             // Inside Center Zone:
             // Cell 4 is Main Goal.
             // Others are SubGoal Titles.
             if (cellIndex === 4) {
               return <GridCell key={cellIndex} text={data.mainGoal} type="main" />;
             }
             const subGoalIdx = cellIndex < 4 ? cellIndex : cellIndex - 1;
             return <GridCell key={cellIndex} text={data.subGoals[subGoalIdx].title} type="sub-main" />;
          })}
        </div>
      );
    }

    // If it's an Outer Zone (Task Grid)
    const subGoal = data.subGoals[contentIndex];
    // This 3x3 grid contains 8 Tasks + The Sub-Goal Title in center
    return (
      <div key={zoneIndex} className="grid grid-cols-3 grid-rows-3 w-full h-full border border-gray-400">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIndex) => {
          if (cellIndex === 4) {
             // Center of an outer zone is the Sub-Goal Title itself
             return <GridCell key={cellIndex} text={subGoal.title} type="sub-main" />;
          }
          const taskIdx = cellIndex < 4 ? cellIndex : cellIndex - 1;
          return <GridCell key={cellIndex} text={subGoal.tasks[taskIdx]} type="task" />;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl animate-fade-in">
      <div className="flex gap-4 mb-6">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-lg font-medium"
        >
          <Download size={18} />
          Exportar PNG
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition shadow-sm font-medium"
        >
          <RefreshCcw size={18} />
          Novo Objetivo
        </button>
      </div>

      {/* The Printable Area Wrapper */}
      {/* Removed overflow-hidden to prevent clipping during capture */}
      <div 
        ref={printRef} 
        id="mandalart-print-area"
        className="p-8 bg-white shadow-2xl rounded-xl mb-8 flex flex-col items-center"
      >
         <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{data.mainGoal}</h2>
            <p className="text-sm text-gray-500 mt-1">Plano Mandalart</p>
         </div>
         
         {/* The 9x9 Master Grid */}
         {/* Use explicit widths for better consistency */}
         <div 
           className="grid grid-cols-3 gap-1 bg-gray-900 border-4 border-gray-900" 
           style={{ width: 'min(95vw, 900px)', height: 'min(95vw, 900px)', aspectRatio: '1/1' }}
         >
           {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((zoneIndex) => renderZone(zoneIndex))}
         </div>

         <div className="w-full text-right mt-2">
            <p className="text-xs text-gray-400">Gerado por IA</p>
         </div>
      </div>
    </div>
  );
};