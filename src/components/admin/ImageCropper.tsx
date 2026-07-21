import { useState, useRef } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function getCroppedImg(
  imageRef: HTMLImageElement,
  pixelCrop: PixelCrop
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    
    // Calculate the scale difference between rendered DOM image and natural original image
    const scaleX = imageRef.naturalWidth / imageRef.width;
    const scaleY = imageRef.naturalHeight / imageRef.height;

    // Set canvas dimensions to the actual cropped size in natural pixels
    canvas.width = Math.floor(pixelCrop.width * scaleX);
    canvas.height = Math.floor(pixelCrop.height * scaleY);
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("No 2d context"));
      return;
    }

    ctx.drawImage(
      imageRef,
      Math.floor(pixelCrop.x * scaleX),
      Math.floor(pixelCrop.y * scaleY),
      Math.floor(pixelCrop.width * scaleX),
      Math.floor(pixelCrop.height * scaleY),
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      resolve(blob);
    }, "image/webp", 0.9);
  });
}

export function ImageCropperModal({ 
  imageUrl, 
  onSave, 
  onCancel,
  title = "Crop Image",
  description = "Drag to select the area to crop.",
  aspectRatio
}: { 
  imageUrl: string; 
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  aspectRatio?: number;
}) {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 50,
    height: 50,
    x: 25,
    y: 25,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop);
      onSave(blob);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold dark:text-white">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>Close</Button>
        </div>
        
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950 p-4 flex items-center justify-center relative min-h-[300px]">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectRatio}
            className="max-h-[50vh]"
          >
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt="Crop preview" 
              className="max-h-[50vh] object-contain"
              crossOrigin="anonymous" 
            />
          </ReactCrop>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing || !completedCrop}>
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Cropped Image
          </Button>
        </div>
      </div>
    </div>
  );
}
