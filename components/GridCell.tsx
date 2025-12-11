import React from 'react';

interface GridCellProps {
  text: string;
  type: 'main' | 'sub-main' | 'task';
  className?: string;
}

export const GridCell: React.FC<GridCellProps> = ({ text, type, className = '' }) => {
  const baseClasses = "flex items-center justify-center p-1 text-center text-xs sm:text-sm border border-gray-300 break-words overflow-hidden h-full w-full select-none transition-colors duration-200";
  
  let typeClasses = "";
  switch (type) {
    case 'main':
      typeClasses = "bg-yellow-300 font-bold text-gray-900 shadow-inner";
      break;
    case 'sub-main':
      typeClasses = "bg-gray-200 font-semibold text-gray-800";
      break;
    case 'task':
      typeClasses = "bg-white text-gray-600 hover:bg-gray-50";
      break;
  }

  return (
    <div className={`${baseClasses} ${typeClasses} ${className}`}>
      <span className="line-clamp-3">{text}</span>
    </div>
  );
};