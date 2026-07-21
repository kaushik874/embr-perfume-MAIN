import { useEffect, useState, useCallback } from "react";
import { adminApi, type ProductFull, type Pagination } from "@/lib/admin-api";
import { AdminLayout } from "./AdminLayout";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ImageCropperModal } from "@/components/admin/ImageCropper";
import { toast } from "sonner";
import { Trash2, Crop } from "lucide-react";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

interface ProductForm {
  slug: string;
  name: string;
  notes: string;
  description: string;
  price: number;
  mrp: number;
  discount_price: number | null;
  stock: number;
  sku: string;
  category: string;
  status: "draft" | "published";
  tags: string;
  collection_type: "primary" | "secondary";
  bestseller: boolean;
  key_features: string;
  how_to_apply: string;
  legal_information: string;
  head_notes: string;
  heart_notes: string;
  base_notes: string;
  review: string;
}

const emptyForm: ProductForm = {
  slug: "", name: "", notes: "", description: "", price: 0, mrp: 0,
  discount_price: null, stock: 0, sku: "", category: "", status: "draft", tags: "", collection_type: "secondary", bestseller: false,
  key_features: "", how_to_apply: "", legal_information: "", head_notes: "", heart_notes: "", base_notes: "", review: ""
};

export function AdminProducts() {
  const [products, setProducts] = useState<ProductFull[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showImages, setShowImages] = useState<number | null>(null);
  // Gallery state for existing images
  const [existingImages, setExistingImages] = useState<{ id: number; url: string; sort_order: number }[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
  const [savingImageOrder, setSavingImageOrder] = useState(false);
  const [croppingImage, setCroppingImage] = useState<{ id: number; url: string; index: number } | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "20", sort };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (stockFilter) params.stock = stockFilter;
      const res = await adminApi.products(params);
      setProducts(res.products);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, statusFilter, stockFilter, sort]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.categories();
      setCategories(res.categories);
    } catch {}
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Load existing images when image modal opens
  const openImages = async (productId: number) => {
    setShowImages(productId);
    setLoadingImages(true);
    try {
      const res = await adminApi.product(productId);
      setExistingImages((res.images || []).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleSaveCrop = async (croppedBlob: Blob) => {
    if (!croppingImage || showImages === null) return;
    setSavingImageOrder(true);
    try {
      const fileName = `crop-${Date.now()}.webp`;
      // Convert blob to raw base64 (strip "data:image/webp;base64," prefix) — server expects raw base64
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });

      // 1. Upload the newly cropped image
      await adminApi.uploadImages(showImages, [{ name: fileName, type: "image/webp", data: dataUrl }]);

      // 2. Reload images to get the new image's id
      const freshRes = await adminApi.product(showImages);
      const freshImages = (freshRes.images || []).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      const newImg = freshImages.find((img) => img.id !== croppingImage.id && !existingImages.some((e) => e.id === img.id));

      // 3. Reorder so the cropped image takes the original's slot
      if (newImg) {
        const orderedIds = freshImages.map((img) => img.id).filter((id) => id !== newImg.id);
        orderedIds.splice(croppingImage.index, 0, newImg.id);
        await adminApi.reorderImages(showImages, orderedIds);
      }

      // 4. Delete the original image
      await adminApi.deleteImage(showImages, croppingImage.id);

      toast.success("Image cropped and saved!");
      setCroppingImage(null);
      await openImages(showImages);
    } catch (err: any) {
      toast.error(err.message || "Failed to save cropped image");
    } finally {
      setSavingImageOrder(false);
    }
  };

  const handleDeleteImage = async (productId: number, imageId: number) => {
    if (!confirm("Delete this image?")) return;
    setDeletingImageId(imageId);
    try {
      await adminApi.deleteImage(productId, imageId);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success("Image deleted");
      fetchProducts(); // refresh to update main image thumbnail
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingImageId(null);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = async (id: number) => {
    try {
      const res = await adminApi.product(id);
      const p = res.product;
      setEditingId(id);
      setForm({
        slug: p.slug,
        name: p.name,
        notes: p.notes || "",
        description: p.description || "",
        price: p.price,
        mrp: p.mrp,
        discount_price: p.discount_price,
        stock: p.stock,
        sku: p.sku || "",
        category: p.category || "",
        status: p.status as "draft" | "published",
        tags: p.tags || "",
        collection_type: p.collection_type as "primary" | "secondary",
        bestseller: Boolean(p.bestseller),
        key_features: p.key_features || "",
        how_to_apply: p.how_to_apply || "",
        legal_information: p.legal_information || "",
        head_notes: p.head_notes || "",
        heart_notes: p.heart_notes || "",
        base_notes: p.base_notes || "",
        review: p.review || "",
      });
      setShowForm(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        notes: form.notes || "",
        discount_price: form.discount_price || null,
        sku: form.sku || null,
        category: form.category || null,
        tags: form.tags || null,
        collection_type: form.collection_type,
        bestseller: form.bestseller ? 1 : 0,
        key_features: form.key_features || null,
        how_to_apply: form.how_to_apply || null,
        legal_information: form.legal_information || null,
        head_notes: form.head_notes || null,
        heart_notes: form.heart_notes || null,
        base_notes: form.base_notes || null,
        review: form.review || null,
      };
      if (editingId) {
        await adminApi.updateProduct(editingId, body);
        toast.success("Product updated");
      } else {
        await adminApi.createProduct(body);
        toast.success("Product created");
      }
      setShowForm(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product permanently?")) return;
    try {
      await adminApi.deleteProduct(id);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setExistingImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setImagePosition = (index: number, position: number) => {
    setExistingImages((current) => {
      const next = [...current];
      const target = Math.max(1, Math.min(next.length, position)) - 1;
      if (target === index) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const saveImageOrder = async () => {
    if (showImages === null || existingImages.length === 0) return;
    setSavingImageOrder(true);
    try {
      await adminApi.reorderImages(showImages, existingImages.map((img) => img.id));
      toast.success("Image order saved");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingImageOrder(false);
    }
  };

  const handleImagesUploaded = async (images: { name: string; type: string; data: string }[]) => {
    if (showImages === null) return;
    try {
      await adminApi.uploadImages(showImages, images);
      toast.success(`${images.length} image(s) uploaded`);
      // Refresh gallery
      const res = await adminApi.product(showImages);
      setExistingImages((res.images || []).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const totalPages = pagination?.totalPages || 1;

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Products</h1>
        <button onClick={openCreate} className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white flex-1 min-w-[200px]"
        />
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
          <option value="">All Stock</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock (≤5)</option>
          <option value="out">Out of Stock</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="price_asc">Price: Low</option>
          <option value="price_desc">Price: High</option>
          <option value="stock">Stock: Low</option>
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl mx-4 p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold font-serif mb-6 text-gray-900 dark:text-white">
              {editingId ? "Edit Product" : "Add Product"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editingId ? form.slug : e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug *</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (MRP) *</label>
                <input type="number" value={form.mrp || ""} onChange={(e) => setForm({ ...form, mrp: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selling Price *</label>
                <input type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Price</label>
                <input type="number" value={form.discount_price || ""} onChange={(e) => setForm({ ...form, discount_price: parseInt(e.target.value) || null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock *</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Type / Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Extrait de Parfum"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "draft" | "published" })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Location</label>
                <select value={form.collection_type} onChange={(e) => setForm({ ...form, collection_type: e.target.value as "primary" | "secondary" })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  <option value="primary">Primary (Home & All Collections)</option>
                  <option value="secondary">Secondary (All Collections Only)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="bestseller"
                  type="checkbox"
                  checked={form.bestseller}
                  onChange={(e) => setForm({ ...form, bestseller: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="bestseller" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mark as Bestseller (shows on website)
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Benefits / Features</label>
                <textarea value={form.key_features} onChange={(e) => setForm({ ...form, key_features: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">How to Apply</label>
                <textarea value={form.how_to_apply} onChange={(e) => setForm({ ...form, how_to_apply: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Head Notes</label>
                <input value={form.head_notes} onChange={(e) => setForm({ ...form, head_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heart Notes</label>
                <input value={form.heart_notes} onChange={(e) => setForm({ ...form, heart_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Notes</label>
                <input value={form.base_notes} onChange={(e) => setForm({ ...form, base_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legal Information</label>
                <textarea value={form.legal_information} onChange={(e) => setForm({ ...form, legal_information: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Featured Review</label>
                <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.slug}
                className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {showImages !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onClick={() => { setShowImages(null); setExistingImages([]); }}>
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl mx-4 p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-white">Product Images</h2>
              <span className="text-sm text-gray-500">{existingImages.length} / 20 uploaded</span>
            </div>

            {/* Existing Images Gallery */}
            {loadingImages ? (
              <p className="text-sm text-gray-400 mb-4 text-center">Loading existing images...</p>
            ) : existingImages.length > 0 ? (
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Uploaded Images</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {existingImages.map((img, idx) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-50 dark:bg-gray-900">
                      <img
                        src={img.url}
                        alt={`Product image ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/bottle-forest.svg";
                        }}
                      />
                      <span className="absolute top-1 left-1 text-[10px] bg-black/75 text-white px-1.5 py-0.5 rounded font-medium">
                        #{idx + 1}
                      </span>
                      {idx === 0 && (
                        <span className="absolute top-1 right-1 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded font-medium">Primary</span>
                      )}
                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1 bg-white/90 rounded px-1 py-1">
                        <label className="flex items-center gap-1 text-[10px] text-gray-700">
                          #
                          <input
                            type="number"
                            min={1}
                            max={existingImages.length}
                            value={idx + 1}
                            onChange={(e) => {
                              const pos = parseInt(e.target.value, 10);
                              if (!Number.isNaN(pos)) setImagePosition(idx, pos);
                            }}
                            className="w-10 rounded border border-gray-300 px-1 py-0.5 text-center text-[10px]"
                          />
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveImage(idx, -1)}
                            disabled={idx === 0}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-800 disabled:opacity-40"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(idx, 1)}
                            disabled={idx === existingImages.length - 1}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-800 disabled:opacity-40"
                          >
                            Down
                          </button>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-start justify-end gap-2 p-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => setCroppingImage({ id: img.id, url: img.url, index: idx })}
                          className="bg-blue-600/90 hover:bg-blue-600 text-white rounded p-1.5 shadow-sm"
                          title="Crop image"
                        >
                          <Crop className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteImage(showImages, img.id)}
                          disabled={deletingImageId === img.id}
                          className="bg-red-600/90 hover:bg-red-600 text-white rounded p-1.5 shadow-sm"
                          title="Delete image"
                        >
                          {deletingImageId === img.id
                            ? <span className="text-white text-[10px]">Deleting...</span>
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Set position number (1, 2, 3...) for each image, then click Save Image Order. Image #1 is the main product photo.
                </p>
                <button
                  type="button"
                  onClick={saveImageOrder}
                  disabled={savingImageOrder}
                  className="mt-3 w-full rounded-md border border-gray-300 dark:border-gray-700 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
                >
                  {savingImageOrder ? "Saving order..." : "Save Image Order"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4 text-center p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">No images uploaded yet.</p>
            )}

            {/* Upload new images */}
            {existingImages.length < 20 ? (
              <div>
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                  Upload More ({20 - existingImages.length} slot{20 - existingImages.length !== 1 ? "s" : ""} remaining)
                </p>
                <ImageUpload
                  onImagesReady={handleImagesUploaded}
                  maxFiles={20 - existingImages.length}
                />
              </div>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                Maximum 20 images reached. Delete an image to upload more.
              </p>
            )}

            <button onClick={() => { setShowImages(null); setExistingImages([]); }} className="mt-6 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 w-full text-center">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No products found.</td></tr>
              ) : products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center shrink-0">
                        {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 object-contain" loading="lazy" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.sku || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">₹{p.price}</span>
                    {p.mrp > p.price && <span className="text-gray-400 line-through text-xs ml-1">₹{p.mrp}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${p.stock === 0 ? "text-red-600" : p.stock <= 5 ? "text-amber-600" : "text-green-600"}`}>
                      {p.stock}
                    </span>
                    {p.stock === 0 && <span className="text-xs text-red-500 ml-1">(OOS)</span>}
                    {p.stock > 0 && p.stock <= 5 && <span className="text-xs text-amber-500 ml-1">(Low)</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.category || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === "published" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p.id)} className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white font-medium mr-3 text-xs">
                      Edit
                    </button>
                    <button onClick={() => openImages(p.id)} className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white font-medium mr-3 text-xs">
                      Images
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 font-medium text-xs">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40">
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      {croppingImage && (
        <ImageCropperModal
          imageUrl={croppingImage.url}
          title="Crop Product Image"
          description="Drag the box to select the area to keep. No aspect ratio is locked — crop freely."
          onSave={handleSaveCrop}
          onCancel={() => setCroppingImage(null)}
        />
      )}
    </AdminLayout>
  );
}
