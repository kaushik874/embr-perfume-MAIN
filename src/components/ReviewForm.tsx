import { useState, useRef } from "react";
import { Star, Upload, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface ReviewFormProps {
  slug: string;
  orderId?: number | null;
  initialData?: any;
  reviewId?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReviewForm({ slug, orderId, initialData, reviewId, onSuccess, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(initialData?.rating || 5);
  const [title, setTitle] = useState(initialData?.title || "");
  const [comment, setComment] = useState(initialData?.comment || "");
  
  // Media states
  const [mediaFiles, setMediaFiles] = useState<{name: string, type: string, data: string, preview: string}[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [existingVideo, setExistingVideo] = useState<string | null>(initialData?.video || null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxFiles = 5;
    if (mediaFiles.length + existingImages.length + files.length > maxFiles + (existingVideo ? 1 : 0)) {
      setError(`You can only upload up to ${maxFiles} images and 1 video.`);
      return;
    }

    const processedFiles = await Promise.all(
      files.map((file) => {
        return new Promise<{name: string, type: string, data: string, preview: string}>((resolve, reject) => {
          if (file.size > 20 * 1024 * 1024) {
            reject(new Error(`${file.name} is larger than 20MB.`));
            return;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              name: file.name,
              type: file.type,
              data: e.target?.result as string,
              preview: e.target?.result as string
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
    ).catch(e => {
      setError(e.message);
      return [];
    });

    setMediaFiles(prev => [...prev, ...processedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeNewFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url: string) => {
    setExistingImages(prev => prev.filter(img => img !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        rating,
        title,
        comment,
        order_id: orderId,
        mediaFiles 
      };

      const effectiveReviewId = initialData?.id || reviewId;
      const url = effectiveReviewId 
        ? `/api/reviews/${effectiveReviewId}`
        : `/api/reviews/${slug}`;

      const method = effectiveReviewId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review");

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-border-light shadow-sm">
      <h3 className="font-display text-xl text-ink uppercase">
        {initialData ? "Edit Your Review" : "Write a Review"}
      </h3>

      {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="focus:outline-none"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= rating ? "fill-gold-deep text-gold-deep" : "text-gray-300"
                } transition-colors`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-1">Review Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          className="w-full px-4 py-2 border border-border-light rounded-md focus:border-gold-deep focus:ring-1 focus:ring-gold-deep outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-1">Review Details</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you like or dislike?"
          className="w-full px-4 py-2 border border-border-light rounded-md focus:border-gold-deep focus:ring-1 focus:ring-gold-deep outline-none min-h-[120px]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">Upload Images / Video (Optional)</label>
        
        <div className="flex flex-wrap gap-4 mb-4">
          {existingImages.map((img) => (
            <div key={img} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border-light">
              <img src={img} alt="review" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeExistingImage(img)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {existingVideo && (
            <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border-light bg-black">
              <video src={existingVideo} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setExistingVideo(null)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {mediaFiles.map((file, i) => (
            <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border-light bg-black">
              {file.type.startsWith("video/") ? (
                <video src={file.preview} className="w-full h-full object-cover" />
              ) : (
                <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeNewFile(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-border-light rounded-lg text-ink-muted hover:border-gold-deep hover:text-gold-deep transition-colors"
          >
            <Upload className="w-6 h-6 mb-1" />
            <span className="text-xs">Add Media</span>
          </button>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="image/*,video/mp4,video/webm"
          className="hidden"
        />
        <p className="text-xs text-ink-muted">Up to 5 images and 1 video. Max 20MB per file.</p>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t border-border-light">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {initialData ? "Update Review" : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}
