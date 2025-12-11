import React from 'react';

interface GridCellProps {
  text: string;
  type: 'main' | 'sub-main' | 'task';
  className?: string;
  onClick?: () => void;
}

export const GridCell: React.FC<GridCellProps> = ({ text, type, className = '', onClick }) => {
  const baseClasses = "flex items-center justify-center p-2 text-center break-words overflow-hidden h-full w-full select-none transition-all duration-200 leading-snug";
  
  let typeClasses = "";
  let interactiveClasses = "";

  switch (type) {
    case 'main':
      typeClasses = "bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-xs sm:text-sm shadow-md z-10";
      break;
    case 'sub-main':
      typeClasses = "bg-indigo-50 text-indigo-900 font-semibold text-[10px] sm:text-xs";
      // Only Sub-Main cells are interactive in this context
      if (onClick) {
        interactiveClasses = "cursor-pointer hover:bg-indigo-100 hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-md z-10";
      }
      break;
    case 'task':
      typeClasses = "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[9px] sm:text-[10px] font-medium";
      break;
  }

  return (
    <div 
      onClick={onClick}
      className={`${baseClasses} ${typeClasses} ${interactiveClasses} ${className}`}
    >
      <span className="line-clamp-4">{text}</span>
    </div>
  );
};