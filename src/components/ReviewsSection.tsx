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

function getReviewStateKey(slug: string) {
  return `embr_reviews_${slug}`;
}

function getSavedReviewState(slug: string): { sort?: string; showAll?: boolean } {
  try {
    const raw = sessionStorage.getItem(getReviewStateKey(slug));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

type MediaItem = { url: string; type: "video" | "image" };

function ReviewCard({
  review,
  user,
  onEdit,
  onDelete,
  onOpenMedia,
  className = "",
}: {
  review: any;
  user: any;
  onEdit: (review: any) => void;
  onDelete: (id: number) => void;
  onOpenMedia: (items: MediaItem[], index: number) => void;
  className?: string;
}) {
  const mediaItems: MediaItem[] = [
    ...(review.video ? [{ url: review.video, type: "video" as const }] : []),
    ...((review.images || []).map((img: string) => ({ url: img, type: "image" as const }))),
  ];

  return (
    <div className={`flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex text-gold-deep mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-4 h-4 ${i <= review.rating ? "fill-current" : "text-gray-300"}`} />
              ))}
            </div>
            <h4 className="font-medium text-ink text-base sm:text-lg line-clamp-1">{review.title}</h4>
            <div className="flex flex-wrap items-center text-xs text-ink-muted mt-1 gap-1.5">
              <span className="font-medium text-ink">{review.author}</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center text-green-600">
                <CheckCircle className="w-3 h-3 mr-0.5" />
                Verified Buyer
              </span>
              <span className="text-gray-300">•</span>
              <span>{new Date(review.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {review.is_pinned === 1 && (
              <span className="bg-gold-light text-gold-deep text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase">
                Pinned
              </span>
            )}
            {review.is_featured === 1 && review.is_pinned !== 1 && (
              <span className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase">
                Featured
              </span>
            )}
            {user && user.id === review.user_id && (
              <div className="flex gap-1 ml-1">
                <Button variant="outline" size="sm" className="h-6 px-1.5 text-xs" onClick={() => onEdit(review)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" className="h-6 px-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => onDelete(review.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm text-ink leading-relaxed">{review.comment}</p>

        {mediaItems.length > 0 && (
          <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1 touch-pan-y" style={{ scrollbarWidth: "none" }}>
            {mediaItems.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onOpenMedia(mediaItems, idx)}
                className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-border-light cursor-pointer group"
              >
                {item.type === "video" ? (
                  <>
                    <video src={item.url} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <img src={item.url} alt="Review attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {review.reply && (
        <div className="mt-4 bg-[#fbf9f4] p-3 rounded-lg border border-gold-light/60 text-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 bg-gold-deep rounded-full flex items-center justify-center text-white font-bold text-[9px]">E</div>
            <span className="font-semibold text-ink">Embr Team</span>
          </div>
          <p className="text-ink-muted">{review.reply}</p>
        </div>
      )}
    </div>
  );
}

export function ReviewsSection({ product }: ReviewsSectionProps) {
  const { user } = useAuth();
  const savedReviewState = getSavedReviewState(product.slug);
  const [sort, setSort] = useState(savedReviewState.sort || "newest");
  const [isWriting, setIsWriting] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [showAll, setShowAll] = useState(Boolean(savedReviewState.showAll));
  const [viewMode, setViewMode] = useState<"slider" | "list">("slider");
  const [selectedMedia, setSelectedMedia] = useState<{
    items: MediaItem[];
    activeIndex: number;
  } | null>(null);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);

  const formRef = useRef<HTMLDivElement>(null);
  const reviewsScrollRef = useRef<HTMLDivElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const reviewsScrollTimer = useRef<number | null>(null);

  // Desktop mouse drag for review cards
  const isReviewDown = useRef(false);
  const reviewStartX = useRef(0);
  const reviewScrollStart = useRef(0);
  const hasReviewDragged = useRef(false);

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
  const displayedReviews = showAll ? reviews : reviews;

  useEffect(() => {
    try {
      sessionStorage.setItem(getReviewStateKey(product.slug), JSON.stringify({ sort, showAll }));
    } catch {}
  }, [product.slug, showAll, sort]);
  
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

  const openMedia = (items: MediaItem[], initialIndex = 0) => {
    setSelectedMedia({ items, activeIndex: initialIndex });
    try {
      const url = new URL(window.location.href);
      url.hash = "review-media";
      window.history.pushState({ ...(window.history.state || {}), embrModal: "review-media" }, "", url);
    } catch {}
  };

  const closeMedia = () => {
    setSelectedMedia(null);
    if (window.history.state?.embrModal === "review-media") {
      try {
        window.history.back();
      } catch {}
    }
  };

  useEffect(() => {
    if (!selectedMedia) return;

    const handlePopState = () => setSelectedMedia(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMedia();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedMedia]);

  // When modal opens at a non-zero index, scroll to that image immediately
  useEffect(() => {
    if (!selectedMedia) return;
    const el = modalScrollRef.current;
    if (el && selectedMedia.activeIndex > 0) {
      el.scrollLeft = selectedMedia.activeIndex * el.clientWidth;
    }
  }, [selectedMedia?.items]);

  const handleReviewsScroll = () => {
    if (isReviewDown.current) return;
    if (reviewsScrollTimer.current) clearTimeout(reviewsScrollTimer.current);
    reviewsScrollTimer.current = window.setTimeout(() => {
      const el = reviewsScrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const card = el.firstElementChild as HTMLElement;
      const cardWidth = card ? card.offsetWidth + 16 : el.clientWidth;
      const idx = Math.round(el.scrollLeft / cardWidth);
      const clamped = Math.max(0, Math.min(displayedReviews.length - 1, idx));
      setActiveReviewIndex(clamped);
    }, 50);
  };

  const scrollToReview = (index: number) => {
    const el = reviewsScrollRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement;
    const cardWidth = card ? card.offsetWidth + 16 : el.clientWidth;
    el.scrollTo({ left: index * cardWidth, behavior: "smooth" });
    setActiveReviewIndex(index);
  };

  const handleReviewsMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = reviewsScrollRef.current;
    if (!el) return;
    isReviewDown.current = true;
    hasReviewDragged.current = false;
    reviewStartX.current = e.pageX;
    reviewScrollStart.current = el.scrollLeft;
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
  };

  const handleReviewsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isReviewDown.current) return;
    const el = reviewsScrollRef.current;
    if (!el) return;
    const delta = e.pageX - reviewStartX.current;
    if (Math.abs(delta) > 5) {
      hasReviewDragged.current = true;
    }
    el.scrollLeft = reviewScrollStart.current - delta;
  };

  const handleReviewsMouseUp = () => {
    if (!isReviewDown.current) return;
    isReviewDown.current = false;
    const el = reviewsScrollRef.current;
    if (!el) return;
    el.style.scrollSnapType = "x mandatory";
    el.style.scrollBehavior = "smooth";
    if (hasReviewDragged.current && el.firstElementChild) {
      const card = el.firstElementChild as HTMLElement;
      const cardWidth = card ? card.offsetWidth + 16 : el.clientWidth;
      const targetIdx = Math.max(0, Math.min(displayedReviews.length - 1, Math.round(el.scrollLeft / cardWidth)));
      el.scrollTo({ left: targetIdx * cardWidth, behavior: "smooth" });
      setActiveReviewIndex(targetIdx);
    }
  };

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink uppercase tracking-wider">
              {reviews.length} {reviews.length === 1 ? "Review" : "Reviews"}
            </span>
            {reviews.length > 1 && (
              <div className="inline-flex rounded-md border border-border-light bg-gray-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("slider")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "slider" ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Slider
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "list" ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  List
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
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
        </div>
      )}

      {showAll && allVideos.length > 0 && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-border-light">
          <h3 className="text-sm font-semibold text-ink mb-3 uppercase tracking-wider">Customer Videos</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 touch-pan-y" style={{ scrollbarWidth: "none" }}>
            {allVideos.map((v: any, i: number) => (
              <div 
                key={i} 
                onClick={() => openMedia(allVideos.map((item: any) => ({ url: item.url, type: 'video' })), i)}
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

      {displayedReviews.length === 0 ? (
        <p className="text-center text-ink-muted py-8">No reviews yet.</p>
      ) : viewMode === "slider" && displayedReviews.length > 1 ? (
        <div>
          {/* Swipeable / Scrollable Reviews Cards */}
          <div
            ref={reviewsScrollRef}
            onScroll={handleReviewsScroll}
            onMouseDown={handleReviewsMouseDown}
            onMouseMove={handleReviewsMouseMove}
            onMouseUp={handleReviewsMouseUp}
            onMouseLeave={handleReviewsMouseUp}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory touch-pan-y pb-4 select-none cursor-grab active:cursor-grabbing"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {displayedReviews.map((review: any) => (
              <ReviewCard
                key={review.id}
                review={review}
                user={user}
                onEdit={(r) => { setEditingReview(r); setIsWriting(true); }}
                onDelete={handleDelete}
                onOpenMedia={openMedia}
                className="w-[85vw] max-w-[360px] sm:w-[380px] shrink-0 snap-start rounded-xl border border-border-light bg-white p-5 shadow-sm"
              />
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center items-center gap-1.5 mt-4">
            {displayedReviews.map((_: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToReview(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeReviewIndex ? "w-5 bg-ink" : "w-1.5 bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Go to review ${i + 1}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {displayedReviews.map((review: any) => (
            <ReviewCard
              key={review.id}
              review={review}
              user={user}
              onEdit={(r) => { setEditingReview(r); setIsWriting(true); }}
              onDelete={handleDelete}
              onOpenMedia={openMedia}
              className="border-b border-border-light pb-8 last:border-0"
            />
          ))}
        </div>
      )}

      {/* Fullscreen Media Modal with working cross and swipeable gallery */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 select-none backdrop-blur-sm"
          onClick={closeMedia}
        >
          {/* Working Close Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeMedia();
            }}
            className="absolute top-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35 hover:scale-105 active:scale-95 backdrop-blur-md transition-all cursor-pointer shadow-lg touch-manipulation"
            aria-label="Close media preview"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div 
            className="relative max-w-5xl max-h-full w-full h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={modalScrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (!el || el.clientWidth === 0) return;
                const newIdx = Math.round(el.scrollLeft / el.clientWidth);
                if (newIdx !== selectedMedia.activeIndex && newIdx >= 0 && newIdx < selectedMedia.items.length) {
                  setSelectedMedia((prev) => prev ? { ...prev, activeIndex: newIdx } : null);
                }
              }}
              className="flex h-full w-full overflow-x-auto snap-x snap-mandatory touch-pan-y"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
            >
              {selectedMedia.items.map((item, idx) => (
                <div
                  key={`${item.url}-${idx}`}
                  className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center p-2"
                >
                  {item.type === 'video' ? (
                    <video 
                      src={item.url} 
                      controls 
                      autoPlay={idx === selectedMedia.activeIndex}
                      className="max-w-full max-h-[85vh] object-contain rounded"
                    />
                  ) : (
                    <img 
                      src={item.url} 
                      alt="Fullscreen review media" 
                      className="max-w-full max-h-[85vh] object-contain rounded"
                    />
                  )}
                </div>
              ))}
            </div>

            {selectedMedia.items.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md">
                {selectedMedia.items.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => {
                      const el = modalScrollRef.current;
                      if (el) {
                        el.scrollTo({ left: dotIdx * el.clientWidth, behavior: "smooth" });
                      }
                      setSelectedMedia((prev) => prev ? { ...prev, activeIndex: dotIdx } : null);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      dotIdx === selectedMedia.activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
                    }`}
                    aria-label={`Go to media ${dotIdx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
