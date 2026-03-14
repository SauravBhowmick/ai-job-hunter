import React, { useState, useCallback } from "react";
import { Upload, File, X, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File, base64: string) => void;
  onClear?: () => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
  uploading?: boolean;
  uploaded?: boolean;
  currentFileName?: string;
}

/**
 * A drag-and-drop and click-to-upload file input for CVs that validates file type and size,
 * converts a selected file to base64, and notifies the parent via a callback.
 *
 * @param onFileSelect - Callback invoked after a file is successfully read; receives the `File` and its base64 string (without the data URL prefix).
 * @param acceptedTypes - Array of allowed file extensions (e.g., [".pdf", ".docx"]). Files with other extensions are rejected.
 * @param maxSizeMB - Maximum allowed file size in megabytes. Files larger than this are rejected.
 * @param className - Optional container CSS class applied to the outermost div.
 * @param disabled - When true, disables user interaction and visual affordances.
 * @param uploading - When true, shows an uploading spinner and disables input actions.
 * @param uploaded - When true and a file name is available, displays a successful upload state.
 * @param currentFileName - Optional fallback file name to display when no local selection exists.
 * @returns The FileUpload React element.
 */
export function FileUpload({
  onFileSelect,
  onClear,
  acceptedTypes = [".pdf", ".doc", ".docx"],
  maxSizeMB = 10,
  className,
  disabled = false,
  uploading = false,
  uploaded = false,
  currentFileName,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      return `Invalid file type. Please upload ${acceptedTypes.join(", ")} files.`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File too large. Maximum size is ${maxSizeMB}MB.`;
    }
    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          setError("Failed to read file");
          return;
        }

        const commaIdx = result.indexOf(",");
        if (commaIdx === -1) {
          setError("Failed to read file");
          return;
        }

        const base64 = result.slice(commaIdx + 1).trim();
        if (!base64) {
          setError("Failed to read file");
          return;
        }

        onFileSelect(file, base64);
      };
      reader.onerror = () => {
        setError("Failed to read file");
      };
      reader.readAsDataURL(file);
    },
    [onFileSelect, acceptedTypes, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled || uploading) {
        return;
      }
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile, disabled, uploading]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) {
      return;
    }
    setIsDragging(true);
  }, [disabled, uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) {
      return;
    }
    setIsDragging(false);
  }, [disabled, uploading]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear?.();
  };

  const displayFileName = selectedFile?.name || currentFileName;

  return (
    <div className={className}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging && "border-primary bg-primary/5",
          uploaded && "border-green-500 bg-green-500/5",
          error && "border-destructive bg-destructive/5",
          disabled && "opacity-50 cursor-not-allowed",
          !isDragging && !uploaded && !error && "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleInputChange}
          disabled={disabled || uploading}
          aria-label="Upload CV file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div>
                <p className="text-lg font-medium">Uploading...</p>
                <p className="text-sm text-muted-foreground">Please wait while we process your CV</p>
              </div>
            </>
          ) : uploaded && displayFileName ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div>
                <p className="text-lg font-medium text-green-600">File uploaded successfully!</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <File className="h-4 w-4" />
                  <span className="text-sm">{displayFileName}</span>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : selectedFile ? (
            <>
              <File className="h-12 w-12 text-primary" />
              <div>
                <p className="text-lg font-medium">File selected</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  {isDragging ? "Drop your file here" : "Upload your CV"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: PDF, DOC, DOCX (max {maxSizeMB}MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2 flex items-center gap-1">
          <X className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}