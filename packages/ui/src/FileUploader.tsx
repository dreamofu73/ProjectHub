import React, { useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';

export interface FileUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
}

export function FileUploader({ files, onChange, maxFiles = 10, maxSizeMB = 50, className = '' }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => file.size <= maxSizeMB * 1024 * 1024);
    if (validFiles.length < newFiles.length) {
      alert(`일부 파일이 최대 크기(${maxSizeMB}MB)를 초과하여 제외되었습니다.`);
    }
    const totalFiles = [...files, ...validFiles].slice(0, maxFiles);
    onChange(totalFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div 
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-gray-50'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Upload size={20} />
          </div>
          <div className="text-sm font-medium">클릭하거나 파일을 이곳으로 드래그하세요</div>
          <div className="text-xs text-muted">최대 {maxFiles}개, 각 {maxSizeMB}MB 이하</div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-border rounded-lg">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FileText size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{file.name}</span>
                  <span className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
