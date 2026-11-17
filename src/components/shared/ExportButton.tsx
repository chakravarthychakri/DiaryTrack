import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

export interface ExportButtonProps {
  onExportExcel: () => void;
  onExportPdf?: () => void;
  onPrint?: () => void;
  label?: string;
  className?: string;
  isExporting?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExportExcel,
  onExportPdf,
  onPrint,
  label = 'Export',
  className,
  isExporting = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        isLoading={isExporting}
        icon={<Download className="w-4 h-4 text-emerald-600" />}
        className="gap-1.5"
      >
        <span>{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-xl ring-1 ring-black/5 divide-y divide-slate-100 z-50 focus:outline-none">
          <div className="p-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onExportExcel();
              }}
              className="flex items-center w-full gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-md transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Download Excel (.xlsx)</span>
            </button>

            {onExportPdf && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onExportPdf();
                }}
                className="flex items-center w-full gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-800 rounded-md transition-colors"
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Executive PDF / Print View</span>
              </button>
            )}

            {onPrint && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onPrint();
                }}
                className="flex items-center w-full gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Direct Print</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
