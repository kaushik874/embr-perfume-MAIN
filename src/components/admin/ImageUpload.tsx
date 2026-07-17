import { useState, useRef, useCallback } from "react";

interface ImageFile {
  file: File;
  preview: string;
  name: string;
  type: string;
  size: number;
}

interface ImageUploadProps {
  onImagesReady: (images: { name: string; type: string; data: string }[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export function ImageUpload({ onImagesReady, maxFiles = 10, maxSizeMB = 5 }: ImageUploadProps) {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid format: ${file.name}. Allowed: jpg, jpeg, png, webp`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File too large: ${file.name}. Max ${maxSizeMB}MB`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setError("");
    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const toAdd: ImageFile[] = [];
    for (let i = 0; i < Math.min(newFiles.length, remaining); i++) {
      const file = newFiles[i];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      toAdd.push({
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }
    if (toAdd.length > 0) {
      setFiles((prev) => [...prev, ...toAdd]);
    }
    if (newFiles.length > remaining) {
      setError(`Only ${remaining} more file(s) allowed`);
    }
  }, [maxFiles, files.length]);

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const convertToBase64 = async (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const optimizeImage = async (file: File) => {
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image compression is not available");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.82);
      });
      if (!blob) throw new Error("Image compression failed");

      const baseName = file.name.replace(/\.[^.]+$/, "");
      return {
        name: `${baseName}.webp`,
        type: "image/webp",
        data: await convertToBase64(blob),
      };
    } catch {
      return {
        name: file.name,
        type: file.type,
        data: await convertToBase64(file),
      };
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    const images = await Promise.all(files.map((f) => optimizeImage(f.file)));
    onImagesReady(images);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-black bg-gray-50 dark:border-white dark:bg-gray-800"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drop images here or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG, JPEG, PNG, WebP up to {maxSizeMB}MB</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {files.map((file, index) => (
            <div key={index} className="relative group">
              <img
                src={file.preview}
                alt={file.name}
                className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
              <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={handleUpload}
          className="w-full bg-black dark:bg-white text-white dark:text-black py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Upload {files.length} image(s)
        </button>
      )}
    </div>
  );
}
