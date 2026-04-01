import { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResumeUploadProps {
  fileName: string | null;
  onFileSelect: (file: File) => void;  // ← changed: accepts File, not string
  onFileRemove: () => void;
}

const ResumeUpload = ({ fileName, onFileSelect, onFileRemove }: ResumeUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx'))) {
        onFileSelect(file);  // ← changed: pass File object
      }
    },
    [onFileSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);  // ← changed: pass File object
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : fileName
          ? 'border-primary/30 bg-primary/5'
          : 'border-border hover:border-primary/40 hover:bg-muted/50'
      }`}
    >
      <AnimatePresence mode="wait">
        {fileName ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{fileName}</span>
              <button onClick={onFileRemove} className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">Ready to analyze</span>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Drop your resume here</p>
              <p className="text-sm text-muted-foreground">PDF or DOCX, max 10MB</p>
            </div>
            <label className="cursor-pointer rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
              Browse Files
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileInput} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResumeUpload;