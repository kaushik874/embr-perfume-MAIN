import { useEffect, useState } from "react";
import { adminApi, type Product } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { CheckCircle, XCircle, Star, MessageSquare, Edit2, Pin, EyeOff, Plus, Trash2, Award, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Modals state
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const loadData = async () => {
    const [revRes, prodRes] = await Promise.all([
      adminApi.getReviews(),
      adminApi.products()
    ]);
    setReviews(revRes.reviews);
    setProducts(prodRes.products);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatus = async (id: number, status: string) => {
    await adminApi.updateReviewStatus(id, status);
    loadData();
  };

  const handleToggleFlag = async (id: number, flag: string, currentValue: number) => {
    await adminApi.updateReviewFlags(id, { [flag]: currentValue === 1 ? false : true });
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Permanently delete this review?")) {
      await adminApi.deleteReview(id);
      loadData();
    }
  };

  const submitReply = async (id: number) => {
    await adminApi.replyToReview(id, replyText);
    setReplyingTo(null);
    setReplyText("");
    loadData();
  };

  const handleSaveForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // In a real scenario we'd do a proper image upload for admin too, but we can reuse our ReviewForm component or just send basic text for manual for now. Let's simplify this.
    // For manual review, we should use a proper form. To keep this simple we'll just send text.
    // We already added image/video uploads to the API, but for admin panel simplicity let's stick to text or we can let them use base64 if they pick files.
    // Let's implement basic form submission.
    
    // Fetch file data
    const files = (e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement).files;
    const mediaFiles: any[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        mediaFiles.push({ name: file.name, type: file.type, data });
      }
    }

    const payload = {
      product_id: Number(formData.get("product_id")),
      rating: Number(formData.get("rating")),
      title: formData.get("title") as string,
      comment: formData.get("comment") as string,
      customer_name: formData.get("customer_name") as string,
      customer_email: formData.get("customer_email") as string,
      customer_phone: formData.get("customer_phone") as string,
      created_at: formData.get("created_at") as string,
      mediaFiles
    };

    if (editingReview) {
      await adminApi.updateReview(editingReview.id, payload as any); // Update route isn't strictly typed yet
    } else {
      await adminApi.createReview(payload as any); // Create route
    }
    
    setShowForm(false);
    setEditingReview(null);
    loadData();
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Product Reviews</h1>
        <Button onClick={() => { setEditingReview(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Manual Review
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {reviews.map((r) => (
          <div key={r.id} className={`bg-white dark:bg-gray-950 p-3 flex flex-col rounded-lg border shadow-sm ${r.is_hidden ? 'opacity-70 border-dashed' : 'border-gray-200 dark:border-gray-800'}`}>
            <div className="flex flex-col gap-3 flex-1">
              {/* Product Info */}
              <div className="w-full text-xs">
                {r.product_image && <img src={r.product_image} alt="product" className="w-full h-24 object-cover rounded mb-1 border" />}
                <p className="font-semibold truncate" title={r.product_name}>{r.product_name}</p>
                <div className="flex flex-wrap gap-2 text-gray-500">
                  <span>ID: #{r.id}</span>
                  {r.order_id && <span>Order: #{r.order_id}</span>}
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Review Content */}
              <div className="flex-1 flex flex-col">
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex text-yellow-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-700'}`} />
                      ))}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center ${r.status === 'approved' ? 'bg-green-100 text-green-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {r.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm line-clamp-2" title={r.title}>{r.title}</h3>
                  
                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-1">
                    {r.is_pinned === 1 && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded flex items-center"><Pin className="w-2.5 h-2.5 mr-0.5"/> Pinned</span>}
                    {r.is_featured === 1 && <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded flex items-center"><Award className="w-2.5 h-2.5 mr-0.5"/> Featured</span>}
                    {r.is_hidden === 1 && <span className="bg-gray-100 text-gray-800 text-[10px] px-1.5 py-0.5 rounded flex items-center"><EyeOff className="w-2.5 h-2.5 mr-0.5"/> Hidden</span>}
                  </div>
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-tight">
                  By <span className="font-semibold text-gray-900 dark:text-white">{r.customer_name || r.user_name || "Guest"}</span> 
                  {(r.customer_email || r.user_email) && <span className="block truncate" title={r.customer_email || r.user_email}>{r.customer_email || r.user_email}</span>}
                  {r.customer_phone && <span className="block">{r.customer_phone}</span>}
                </div>

                <p className="text-xs text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap line-clamp-4">{r.comment}</p>

                {/* Media */}
                <div className="flex gap-1 overflow-x-auto mb-3 pb-1">
                  {r.video && (
                    <video src={r.video} controls className="w-16 h-16 shrink-0 object-cover rounded border" />
                  )}
                  {r.images?.map((img: string, i: number) => (
                    <img key={i} src={img} className="w-16 h-16 shrink-0 object-cover rounded border" alt="" />
                  ))}
                </div>

                {/* Reply */}
                {r.reply ? (
                  <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs mb-3 border">
                    <p className="font-semibold mb-0.5">Your Reply:</p>
                    <p className="line-clamp-2" title={r.reply}>{r.reply}</p>
                    <button onClick={() => {setReplyingTo(r.id); setReplyText(r.reply);}} className="text-blue-600 text-[10px] mt-1">Edit Reply</button>
                  </div>
                ) : (
                  replyingTo !== r.id && (
                    <button onClick={() => setReplyingTo(r.id)} className="text-blue-600 text-xs flex items-center mb-3">
                      <MessageSquare className="w-3 h-3 mr-1" /> Add Reply
                    </button>
                  )
                )}

                {replyingTo === r.id && (
                  <div className="flex flex-col gap-1 mt-1 mb-3">
                    <textarea 
                      value={replyText} 
                      onChange={e => setReplyText(e.target.value)} 
                      placeholder="Response..." 
                      className="w-full p-1.5 border rounded text-xs min-h-[60px]"
                    />
                    <div className="flex gap-1">
                      <Button onClick={() => submitReply(r.id)} size="sm" className="h-6 text-[10px] px-2 py-0">Save</Button>
                      <Button onClick={() => setReplyingTo(null)} variant="outline" size="sm" className="h-6 text-[10px] px-2 py-0">Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-1 pt-2 border-t mt-auto">
                  {r.status !== 'approved' && (
                    <Button variant="outline" size="sm" onClick={() => handleStatus(r.id, 'approved')} className="h-6 text-[10px] px-1.5 py-0 text-green-600 border-green-200 hover:bg-green-50 flex-1">
                      <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button variant="outline" size="sm" onClick={() => handleStatus(r.id, 'rejected')} className="h-6 text-[10px] px-1.5 py-0 text-red-600 border-red-200 hover:bg-red-50 flex-1">
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  )}
                  
                  <div className="w-full h-px bg-gray-100 my-0.5" />

                  <Button variant="outline" size="sm" onClick={() => handleToggleFlag(r.id, 'is_pinned', r.is_pinned)} className="h-6 text-[10px] px-1.5 py-0 flex-1">
                    <Pin className={`w-3 h-3 mr-1 ${r.is_pinned ? 'fill-current' : ''}`} /> {r.is_pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  
                  <Button variant="outline" size="sm" onClick={() => handleToggleFlag(r.id, 'is_featured', r.is_featured)} className="h-6 text-[10px] px-1.5 py-0 flex-1">
                    <Award className={`w-3 h-3 mr-1 ${r.is_featured ? 'fill-current' : ''}`} /> {r.is_featured ? 'Unfeat' : 'Feat'}
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => handleToggleFlag(r.id, 'is_hidden', r.is_hidden)} className="h-6 text-[10px] px-1.5 py-0 flex-1">
                    {r.is_hidden ? <><Eye className="w-3 h-3 mr-1" /> Show</> : <><EyeOff className="w-3 h-3 mr-1" /> Hide</>}
                  </Button>

                  <div className="w-full h-px bg-gray-100 my-0.5" />

                  <Button variant="outline" size="sm" onClick={() => {setEditingReview(r); setShowForm(true);}} className="h-6 text-[10px] px-1.5 py-0 flex-1">
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(r.id)} className="h-6 text-[10px] px-1.5 py-0 text-red-600 border-red-200 hover:bg-red-50 flex-1">
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>

              </div>
            </div>
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="text-gray-500 text-center py-12 bg-white dark:bg-gray-950 rounded border border-dashed">No reviews found.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center p-4 overflow-y-auto z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full my-auto shadow-xl">
            <h2 className="text-xl font-bold mb-4">{editingReview ? "Edit Review" : "Add Manual Review"}</h2>
            <form onSubmit={handleSaveForm} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Product</label>
                  <select name="product_id" required defaultValue={editingReview?.product_id} className="w-full p-2 border rounded">
                    <option value="">Select Product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rating</label>
                  <select name="rating" required defaultValue={editingReview?.rating || 5} className="w-full p-2 border rounded">
                    {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stars</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name</label>
                  <input type="text" name="customer_name" required defaultValue={editingReview?.customer_name || editingReview?.user_name} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Email (Optional)</label>
                  <input type="email" name="customer_email" defaultValue={editingReview?.customer_email || editingReview?.user_email} className="w-full p-2 border rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Phone (Optional)</label>
                  <input type="text" name="customer_phone" defaultValue={editingReview?.customer_phone} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Review Date (Optional)</label>
                  <input type="datetime-local" name="created_at" defaultValue={editingReview?.created_at ? new Date(editingReview.created_at).toISOString().slice(0,16) : ""} className="w-full p-2 border rounded" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Review Title</label>
                <input type="text" name="title" required defaultValue={editingReview?.title} className="w-full p-2 border rounded" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Comment</label>
                <textarea name="comment" required defaultValue={editingReview?.comment} className="w-full p-2 border rounded h-24" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Upload New Media (Replaces old)</label>
                <input type="file" multiple accept="image/*,video/mp4,video/webm" className="w-full p-2 border rounded" />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">Save Review</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
