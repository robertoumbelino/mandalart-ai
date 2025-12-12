import React from 'react';
import { Check } from 'lucide-react';

interface GridCellProps {
  text: string;
  type: 'main' | 'sub-main' | 'task';
  className?: string;
  onClick?: () => void;
  isCompleted?: boolean;
}

export const GridCell: React.FC<GridCellProps> = ({ text, type, className = '', onClick, isCompleted }) => {
  const baseClasses = "relative flex items-center justify-center p-2 text-center break-words overflow-hidden h-full w-full select-none transition-all duration-300 leading-tight";
  
  let typeClasses = "";
  let interactiveClasses = "";

  switch (type) {
    case 'main':
      typeClasses = "bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-xs sm:text-sm shadow-md z-10";
      break;
    case 'sub-main':
      typeClasses = "bg-indigo-50 text-indigo-900 font-semibold text-[10px] sm:text-xs z-10";
      // Sub-mains are static headers in this new version, interaction is on tasks
      break;
    case 'task':
      if (isCompleted) {
        typeClasses = "bg-emerald-100 text-emerald-900 border-emerald-200 text-[9px] sm:text-[10px] font-medium";
      } else {
        typeClasses = "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[9px] sm:text-[10px] font-medium";
      }
      
      if (onClick) {
        interactiveClasses = "cursor-pointer hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-md z-0";
      }
      break;
  }

  return (
    <div 
      onClick={onClick}
      className={`${baseClasses} ${typeClasses} ${interactiveClasses} ${className}`}
    >
      <span className="line-clamp-4 relative z-10">{text}</span>
      
      {/* Completion Badge */}
      {isCompleted && type === 'task' && (
        <div className="absolute top-1 right-1 text-emerald-600 opacity-50">
          <Check size={10} strokeWidth={4} />
        </div>
      )}
    </div>
  );
};