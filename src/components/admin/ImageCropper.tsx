import { useEffect, useMemo, useRef, useState } from "react";
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

export type FrameCrop = {
  x: number;
  y: number;
  zoom: number;
};

type FrameCropperModalProps = {
  imageUrl: string;
  onSave: (blob: Blob, crop: FrameCrop) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  initialCrop?: FrameCrop | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function FrameCropperModal({
  imageUrl,
  onSave,
  onCancel,
  title = "Crop Image",
  description = "Move and zoom the image inside the frame.",
  aspectRatio,
  outputWidth,
  outputHeight,
  initialCrop,
}: FrameCropperModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; cropX: number; cropY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<FrameCrop>(initialCrop ?? { x: 0, y: 0, zoom: 1 });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setFrameSize({ width: frame.clientWidth, height: frame.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const drawSize = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height || !frameSize.width || !frameSize.height) {
      return { width: 0, height: 0 };
    }
    const baseScale = Math.max(frameSize.width / naturalSize.width, frameSize.height / naturalSize.height);
    return {
      width: naturalSize.width * baseScale * crop.zoom,
      height: naturalSize.height * baseScale * crop.zoom,
    };
  }, [crop.zoom, frameSize.height, frameSize.width, naturalSize.height, naturalSize.width]);

  const constrainedCrop = useMemo(() => {
    const maxX = Math.max(0, (drawSize.width - frameSize.width) / 2);
    const maxY = Math.max(0, (drawSize.height - frameSize.height) / 2);
    return {
      x: clamp(crop.x, -maxX, maxX),
      y: clamp(crop.y, -maxY, maxY),
      zoom: crop.zoom,
    };
  }, [crop, drawSize.height, drawSize.width, frameSize.height, frameSize.width]);

  useEffect(() => {
    if (
      constrainedCrop.x !== crop.x ||
      constrainedCrop.y !== crop.y ||
      constrainedCrop.zoom !== crop.zoom
    ) {
      setCrop(constrainedCrop);
    }
  }, [constrainedCrop, crop]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: crop.x,
      cropY: crop.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const maxX = Math.max(0, (drawSize.width - frameSize.width) / 2);
    const maxY = Math.max(0, (drawSize.height - frameSize.height) / 2);
    setCrop((current) => ({
      ...current,
      x: clamp(drag.cropX + event.clientX - drag.startX, -maxX, maxX),
      y: clamp(drag.cropY + event.clientY - drag.startY, -maxY, maxY),
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const handleSave = async () => {
    const image = imgRef.current;
    if (!image || !frameSize.width || !frameSize.height || !drawSize.width || !drawSize.height) return;

    setIsProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image processing is not available");

      const scaleX = outputWidth / frameSize.width;
      const scaleY = outputHeight / frameSize.height;
      const dx = ((frameSize.width - drawSize.width) / 2 + crop.x) * scaleX;
      const dy = ((frameSize.height - drawSize.height) / 2 + crop.y) * scaleY;

      ctx.fillStyle = "#f7f7f5";
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      ctx.drawImage(image, dx, dy, drawSize.width * scaleX, drawSize.height * scaleY);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.9);
      });
      if (!blob) throw new Error("Image crop failed");
      onSave(blob, crop);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
    }
  };

  const imageStyle = {
    width: `${drawSize.width}px`,
    height: `${drawSize.height}px`,
    transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold dark:text-white">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>Close</Button>
        </div>

        <div className="grid flex-1 gap-5 overflow-auto bg-gray-100 p-4 dark:bg-gray-950 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="flex min-h-[420px] items-center justify-center">
            <div
              ref={frameRef}
              className="relative w-full max-w-[420px] cursor-grab touch-none overflow-hidden border border-gray-300 bg-[#f7f7f5] shadow-sm active:cursor-grabbing dark:border-gray-700"
              style={{ aspectRatio }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop preview"
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={imageStyle}
                draggable={false}
                crossOrigin="anonymous"
                onLoad={(event) => {
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
              />
            </div>
          </div>

          <div className="space-y-5 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Live Preview</p>
              <div className="overflow-hidden border border-gray-200 bg-[#f7f7f5] dark:border-gray-700" style={{ aspectRatio }}>
                <img
                  src={imageUrl}
                  alt=""
                  className="relative left-1/2 top-1/2 max-w-none select-none"
                  style={imageStyle}
                  draggable={false}
                />
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={crop.zoom}
                onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}
                className="mt-2 w-full"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-800">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing || !naturalSize.width}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Cropped Image
          </Button>
        </div>
      </div>
    </div>
  );
}
