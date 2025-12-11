import React from 'react';

interface GridCellProps {
  text: string;
  type: 'main' | 'sub-main' | 'task';
  className?: string;
}

export const GridCell: React.FC<GridCellProps> = ({ text, type, className = '' }) => {
  const baseClasses = "flex items-center justify-center p-2 text-center break-words overflow-hidden h-full w-full select-none transition-all duration-200 leading-snug";
  
  let typeClasses = "";
  switch (type) {
    case 'main':
      // Center Goal: Gradient, White Text, Shadow, Slightly Larger
      typeClasses = "bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-xs sm:text-sm shadow-md z-10";
      break;
    case 'sub-main':
      // Sub-Goals: Soft Indigo background, Darker text
      typeClasses = "bg-indigo-50 text-indigo-900 font-semibold text-[10px] sm:text-xs";
      break;
    case 'task':
      // Tasks: Clean White, Soft Gray text
      typeClasses = "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[9px] sm:text-[10px] font-medium";
      break;
  }

  return (
    <div className={`${baseClasses} ${typeClasses} ${className}`}>
      <span className="line-clamp-4">{text}</span>
    </div>
  );
};