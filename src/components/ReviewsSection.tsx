import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, CheckCircle, Video, Image as ImageIcon } from "lucide-react";
import { Button } from "./ui/button";
import { ReviewForm } from "./ReviewForm";
import type { Product } from "@/lib/api";

interface ReviewsSectionProps {
  product: Product;
}

export function ReviewsSection({ product }: ReviewsSectionProps) {
  const [sort, setSort] = useState("newest");
  const [isWriting, setIsWriting] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
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
    refetchEligibility();
    refetchReviews();
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
                ? "You have already reviewed this product."
                : "You purchased this product. Write a review!"
              : "Only customers who have purchased this product can review."
            }
          </p>
          
          {eligibility?.eligible && (
            <Button 
              onClick={() => setIsWriting(true)}
              variant={eligibility?.hasReviewed ? "outline" : "default"}
            >
              {eligibility?.hasReviewed ? "Edit Your Review" : "Write a Review"}
            </Button>
          )}
        </div>
      </div>

      {isWriting && eligibility && (
        <div ref={formRef} className="mb-12 scroll-mt-24">
          <ReviewForm 
            slug={product.slug}
            initialData={eligibility.hasReviewed ? reviews.find((r: any) => r.id === eligibility.reviewId) : null}
            orderId={eligibility.orderId}
            onSuccess={handleReviewSuccess}
            onCancel={() => setIsWriting(false)}
          />
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mb-6 flex justify-end">
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
        </div>
      )}

      <div className="space-y-8">
        {reviews.length === 0 ? (
          <p className="text-center text-ink-muted py-8">No reviews yet.</p>
        ) : (
          reviews.map((review: any) => (
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
                
                {review.is_pinned === 1 && (
                  <span className="bg-gold-light text-gold-deep text-xs px-2 py-1 rounded font-medium">
                    Pinned
                  </span>
                )}
                {review.is_featured === 1 && review.is_pinned !== 1 && (
                  <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium">
                    Featured
                  </span>
                )}
              </div>

              <p className="mt-4 text-ink">{review.comment}</p>

              {((review.images && review.images.length > 0) || review.video) && (
                <div className="flex gap-4 mt-4 overflow-x-auto pb-2">
                  {review.video && (
                    <div className="relative w-24 h-24 flex-shrink-0 bg-black rounded-md overflow-hidden group cursor-pointer">
                      <video src={review.video} className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  )}
                  {review.images && review.images.map((img: string, i: number) => (
                    <div key={i} className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden border border-border-light">
                      <img src={img} alt="Review attachment" className="w-full h-full object-cover hover:scale-105 transition-transform" />
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
    </div>
  );
}
