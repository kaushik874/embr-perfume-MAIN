import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, CheckCircle, Video, Image as ImageIcon, Trash2, Edit2, X, Play } from "lucide-react";
import { Button } from "./ui/button";
import { ReviewForm } from "./ReviewForm";
import { useAuth } from "@/contexts/AuthContext";
import type { Product } from "@/lib/api";

interface ReviewsSectionProps {
  product: Product;
}

export function ReviewsSection({ product }: ReviewsSectionProps) {
  const { user } = useAuth();
  const [sort, setSort] = useState("newest");
  const [isWriting, setIsWriting] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'video' | 'image'} | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const { data: eligibility, refetch: refetchEligibility } = useQuery({
    queryKey: ["/api/reviews/eligibility", product.slug],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/eligibility/${product.slug}`);
      if (!res.ok) return { eligible: false, hasReviewed: false };
      return res.json();
    }
  });

  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ["/api/reviews", product.slug, sort],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${product.slug}?sort=${sort}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    }
  });

  useEffect(() => {
    if (eligibility?.eligible && !isWriting && !hasAutoOpened && window.location.hash === "#reviews") {
      setIsWriting(true);
      setHasAutoOpened(true);
      // Remove hash to prevent reopening on subsequent renders
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [eligibility, hasAutoOpened, isWriting]);

  const reviews = reviewsData?.reviews || [];
  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);
  
  const allVideos = reviews.filter((r: any) => r.video).map((r: any) => ({
    url: r.video,
    reviewId: r.id
  }));
  
  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const count5 = reviews.filter((r: any) => r.rating === 5).length;
  const count4 = reviews.filter((r: any) => r.rating === 4).length;
  const count3 = reviews.filter((r: any) => r.rating === 3).length;
  const count2 = reviews.filter((r: any) => r.rating === 2).length;
  const count1 = reviews.filter((r: any) => r.rating === 1).length;

  const getPercentage = (count: number) => {
    if (reviews.length === 0) return 0;
    return Math.round((count / reviews.length) * 100);
  };

  const handleReviewSuccess = () => {
    setIsWriting(false);
    setEditingReview(null);
    refetchReviews();
    refetchEligibility();
  };

  const handleDelete = async (reviewId: number) => {

    try {
      await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
      refetchReviews();
      refetchEligibility();
    } catch (e) {
      console.error("Failed to delete review", e);
    }
  };

  useEffect(() => {
    if (isWriting && formRef.current) {
      // Small timeout to allow render
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [isWriting]);

  return (
    <div id="reviews" className="py-12 border-t border-border-light">
      <h2 className="font-display text-3xl uppercase text-ink mb-8 text-center">Customer Reviews</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div className="text-center md:text-left flex flex-col items-center md:items-start">
          <div className="text-5xl font-display text-ink">{avgRating}</div>
          <div className="flex text-gold-deep my-2">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-5 h-5 ${i <= Number(avgRating) ? 'fill-current' : 'text-gray-300'}`} />
            ))}
          </div>
          <div className="text-ink-muted">{reviews.length} Reviews</div>
        </div>

        <div className="space-y-2 col-span-1">
          {[
            { stars: 5, count: count5 },
            { stars: 4, count: count4 },
            { stars: 3, count: count3 },
            { stars: 2, count: count2 },
            { stars: 1, count: count1 },
          ].map((item) => (
            <div key={item.stars} className="flex items-center text-sm">
              <span className="w-12 text-ink-muted">{item.stars} Stars</span>
              <div className="flex-1 h-2 mx-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gold-deep"
                  style={{ width: `${getPercentage(item.count)}%` }}
                />
              </div>
              <span className="w-8 text-right text-ink-muted">{item.count}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center border-l border-border-light pl-0 md:pl-12">
          <h3 className="font-medium text-ink mb-2">Share your thoughts</h3>
          <p className="text-sm text-ink-muted mb-4 text-center">
            {eligibility?.eligible 
              ? eligibility?.hasReviewed 
                ? "You have reached the maximum number of reviews for this product."
                : "You purchased this product. Write a review!"
              : "Only customers who have purchased this product can review."
            }
          </p>
          
          {eligibility?.eligible && !eligibility?.hasReviewed && (
            <Button 
              onClick={() => { setEditingReview(null); setIsWriting(true); }}
            >
              Write a Review
            </Button>
          )}
        </div>
      </div>

      {isWriting && eligibility && (
        <div ref={formRef} className="mb-12 scroll-mt-24">
          <ReviewForm 
            slug={product.slug}
            initialData={editingReview}
            reviewId={editingReview?.id}
            orderId={eligibility.orderId}
            onSuccess={handleReviewSuccess}
            onCancel={() => { setIsWriting(false); setEditingReview(null); }}
          />
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mb-6 flex justify-end">
          {!showAll ? (
            <Button variant="outline" onClick={() => setShowAll(true)}>
              All Reviews
            </Button>
          ) : (
            <select 
              value={sort} 
              onChange={e => setSort(e.target.value)}
              className="border border-border-light rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-gold-deep"
            >
              <option value="newest">Newest First</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
              <option value="oldest">Oldest First</option>
            </select>
          )}
        </div>
      )}

      {showAll && allVideos.length > 0 && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-border-light">
          <h3 className="text-sm font-semibold text-ink mb-3 uppercase tracking-wider">Customer Videos</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {allVideos.map((v: any, i: number) => (
              <div 
                key={i} 
                onClick={() => setSelectedMedia({ url: v.url, type: 'video' })}
                className="relative w-32 h-32 flex-shrink-0 bg-black rounded-md overflow-hidden group cursor-pointer border border-border-light"
              >
                <video src={v.url} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {displayedReviews.length === 0 ? (
          <p className="text-center text-ink-muted py-8">No reviews yet.</p>
        ) : (
          displayedReviews.map((review: any) => (
            <div key={review.id} className="border-b border-border-light pb-8 last:border-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex text-gold-deep mb-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= review.rating ? 'fill-current' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <h4 className="font-medium text-ink text-lg">{review.title}</h4>
                  <div className="flex items-center text-sm text-ink-muted mt-1 gap-2">
                    <span className="font-medium">{review.author}</span>
                    <span className="text-gray-300">•</span>
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified Buyer
                    </span>
                    <span className="text-gray-300">•</span>
                    <span>{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {review.is_pinned === 1 && (
                    <span className="bg-gold-light text-gold-deep text-xs px-2 py-1 rounded font-medium h-fit">
                      Pinned
                    </span>
                  )}
                  {review.is_featured === 1 && review.is_pinned !== 1 && (
                    <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium h-fit">
                      Featured
                    </span>
                  )}
                  {user && user.id === review.user_id && (
                    <div className="flex gap-1 ml-2">
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => { setEditingReview(review); setIsWriting(true); }}>
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDelete(review.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-4 text-ink">{review.comment}</p>

              {((review.images && review.images.length > 0) || review.video) && (
                <div className="flex gap-4 mt-4 overflow-x-auto pb-2">
                  {review.video && (
                    <div 
                      onClick={() => setSelectedMedia({ url: review.video, type: 'video' })}
                      className="relative w-24 h-24 flex-shrink-0 bg-black rounded-md overflow-hidden group cursor-pointer"
                    >
                      <video src={review.video} className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                      </div>
                    </div>
                  )}
                  {review.images && review.images.map((img: string, i: number) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedMedia({ url: img, type: 'image' })}
                      className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden border border-border-light cursor-pointer group"
                    >
                      <img src={img} alt="Review attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  ))}
                </div>
              )}

              {review.reply && (
                <div className="mt-6 bg-cream-light p-4 rounded-md border border-gold-light">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gold-deep rounded-full flex items-center justify-center text-white font-bold text-xs">E</div>
                    <span className="font-medium text-ink text-sm">Embr Team</span>
                  </div>
                  <p className="text-sm text-ink-muted">{review.reply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button 
            onClick={() => setSelectedMedia(null)}
            className="absolute top-4 right-4 p-2 text-white hover:text-gold-light transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="relative max-w-5xl max-h-full w-full h-full flex items-center justify-center">
            {selectedMedia.type === 'video' ? (
              <video 
                src={selectedMedia.url} 
                controls 
                autoPlay 
                className="max-w-full max-h-[90vh] object-contain rounded"
              />
            ) : (
              <img 
                src={selectedMedia.url} 
                alt="Fullscreen review media" 
                className="max-w-full max-h-[90vh] object-contain rounded"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
