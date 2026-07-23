import { useEffect, useState, useCallback } from "react";
import { adminApi, HeroBanner } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageCropperModal } from "@/components/admin/ImageCropper";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

function normalizeBanner(banner: HeroBanner, index: number): HeroBanner {
  return {
    ...banner,
    title: banner.title ?? "",
    subtitle: banner.subtitle ?? "",
    description: banner.description ?? "",
    imageUrl: banner.imageUrl ?? "",
    mobileImageUrl: banner.mobileImageUrl ?? "",
    productName: banner.productName ?? "",
    productUrl: banner.productUrl ?? "",
    badge: banner.badge ?? "",
    buttonText: banner.buttonText ?? "",
    buttonLink: banner.buttonLink ?? "",
    showButton: banner.showButton ?? 1,
    darkOverlay: banner.darkOverlay ?? 1,
    imageFit: banner.imageFit || "cover",
    imagePosition: banner.imagePosition || "center center",
    mobileImagePosition: banner.mobileImagePosition || "center center",
    showText: banner.showText ? 1 : 0,
    isActive: banner.isActive ? 1 : 0,
    displayOrder: index,
  };
}

function newBanner(displayOrder: number): HeroBanner {
  return {
    id: -(Date.now() + displayOrder),
    title: "",
    subtitle: "",
    description: "",
    imageUrl: "",
    mobileImageUrl: "",
    productName: "",
    productUrl: "",
    badge: "",
    buttonText: "Shop Now",
    buttonLink: "/collections",
    showButton: 1,
    darkOverlay: 0,
    imageFit: "cover",
    imagePosition: "center center",
    mobileImagePosition: "center center",
    showText: 1,
    isActive: 1,
    displayOrder,
  };
}

function toPayload(banner: HeroBanner, displayOrder: number): Partial<HeroBanner> {
  return {
    title: banner.title ?? "",
    subtitle: banner.subtitle ?? "",
    description: banner.description ?? "",
    imageUrl: (banner.imageUrl ?? "").trim(),
    mobileImageUrl: (banner.mobileImageUrl ?? "").trim(),
    productName: banner.productName ?? "",
    productUrl: banner.productUrl ?? "",
    badge: banner.badge ?? "",
    buttonText: banner.buttonText ?? "",
    buttonLink: banner.buttonLink ?? "",
    showButton: banner.showButton ? 1 : 0,
    darkOverlay: banner.darkOverlay ? 1 : 0,
    imageFit: banner.imageFit || "cover",
    imagePosition: banner.imagePosition || "center center",
    mobileImagePosition: banner.mobileImagePosition || "center center",
    showText: banner.showText ? 1 : 0,
    isActive: banner.isActive ? 1 : 0,
    displayOrder,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

export function AdminHero() {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [croppingBannerIndex, setCroppingBannerIndex] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getHeroBanners();
      setBanners(res.banners.map(normalizeBanner));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = <K extends keyof HeroBanner>(
    index: number,
    field: K,
    value: HeroBanner[K],
  ) => {
    setBanners((current) =>
      current.map((banner, i) => (i === index ? { ...banner, [field]: value } : banner)),
    );
  };

  const persistOrder = async (items: HeroBanner[]) => {
    const orders = items
      .map((banner, index) => ({ id: banner.id, displayOrder: index }))
      .filter((order) => order.id > 0);
    if (orders.length) await adminApi.reorderHeroBanners(orders);
  };

  const moveBanner = async (index: number, dir: -1 | 1) => {
    if (index + dir < 0 || index + dir >= banners.length) return;
    const next = [...banners];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    const ordered = next.map(normalizeBanner);
    setBanners(ordered);

    try {
      await persistOrder(ordered);
      toast.success("Banner order updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder banners");
      loadData();
    }
  };

  const saveBannerAt = async (index: number, items = banners) => {
    const banner = items[index];
    if (!banner) return false;

    const payload = toPayload(banner, index);
    if (!payload.imageUrl) {
      toast.error(`Banner #${index + 1} needs an image before saving`);
      return false;
    }

    setSaving(banner.id);
    try {
      if (banner.id < 0) {
        const res = await adminApi.createHeroBanner(payload);
        const savedId = Number(res.id);
        setBanners((current) =>
          current.map((item) => (item.id === banner.id ? { ...item, id: savedId, displayOrder: index } : item)),
        );
        return true;
      }

      await adminApi.updateHeroBanner(banner.id, payload);
      setBanners((current) =>
        current.map((item) => (item.id === banner.id ? { ...item, displayOrder: index } : item)),
      );
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save banner");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const handleSave = async (index: number) => {
    const ok = await saveBannerAt(index);
    if (ok) toast.success("Banner saved");
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    const next = [...banners].map(normalizeBanner);

    try {
      for (let i = 0; i < next.length; i += 1) {
        const banner = next[i];
        const payload = toPayload(banner, i);
        if (!payload.imageUrl) {
          toast.error(`Banner #${i + 1} needs an image before saving`);
          return;
        }

        setSaving(banner.id);
        if (banner.id < 0) {
          const res = await adminApi.createHeroBanner(payload);
          next[i] = { ...banner, id: Number(res.id), displayOrder: i };
        } else {
          await adminApi.updateHeroBanner(banner.id, payload);
          next[i] = { ...banner, displayOrder: i };
        }
      }

      await persistOrder(next);
      setBanners(next);
      toast.success("All hero banners saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save all banners");
    } finally {
      setSaving(null);
      setSavingAll(false);
    }
  };

  const handleDelete = async (index: number) => {
    const banner = banners[index];
    if (!banner) return;

    try {
      if (banner.id > 0) await adminApi.deleteHeroBanner(banner.id);
      const next = banners.filter((_, i) => i !== index).map(normalizeBanner);
      setBanners(next);
      await persistOrder(next);
      toast.success("Banner deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete banner");
    }
  };

  const handleAdd = () => {
    setBanners((current) => [...current, newBanner(current.length)]);
  };

  const publishUploadedImage = async (banner: HeroBanner, index: number, field: "imageUrl" | "mobileImageUrl", url: string) => {
    const updatedBanner = { ...banner, [field]: url, isActive: 1, darkOverlay: 0, showText: banner.showText ? 1 : 0 };
    const payload = toPayload(updatedBanner, index);

    if (updatedBanner.id < 0) {
      const res = await adminApi.createHeroBanner(payload);
      const savedBanner = { ...updatedBanner, id: Number(res.id), displayOrder: index };
      setBanners((current) =>
        current.map((item) => (item.id === banner.id ? savedBanner : item)).map(normalizeBanner),
      );
      return savedBanner;
    }

    await adminApi.updateHeroBanner(updatedBanner.id, payload);
    setBanners((current) =>
      current.map((item) => (item.id === banner.id ? { ...updatedBanner, displayOrder: index } : item)).map(normalizeBanner),
    );
    return updatedBanner;
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>, index: number, field: "imageUrl" | "mobileImageUrl" = "imageUrl") => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const banner = banners[index];
    if (!banner) return;

    setUploading(banner.id);
    try {
      const data = await readFileAsDataUrl(file);
      const res = await adminApi.uploadHeroBannerImage({ name: file.name, data });
      await publishUploadedImage(banner, index, field, res.url);
      toast.success("Image uploaded and published in the hero slider");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setUploading(null);
    }
  };

  const handleUploadNewBanner = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const tempBanner = newBanner(banners.length);
    setBanners((current) => [...current, tempBanner]);
    setUploading(tempBanner.id);

    try {
      const data = await readFileAsDataUrl(file);
      const upload = await adminApi.uploadHeroBannerImage({ name: file.name, data });
      const publishedBanner = {
        ...tempBanner,
        imageUrl: upload.url,
        title: "New Banner",
        buttonText: "Shop Now",
        buttonLink: "/collections",
        showButton: 1,
        darkOverlay: 0,
        imageFit: "cover",
        imagePosition: "center center",
        mobileImagePosition: "center center",
        isActive: 1,
        showText: 1,
      };
      const created = await adminApi.createHeroBanner(toPayload(publishedBanner, banners.length));
      setBanners((current) =>
        current
          .map((banner) =>
            banner.id === tempBanner.id
              ? { ...publishedBanner, id: Number(created.id), displayOrder: banners.length }
              : banner,
          )
          .map(normalizeBanner),
      );
      toast.success("New banner uploaded and published in the hero slider");
    } catch (error) {
      setBanners((current) => current.filter((banner) => banner.id !== tempBanner.id).map(normalizeBanner));
      toast.error(error instanceof Error ? error.message : "Failed to upload new banner");
    } finally {
      setUploading(null);
    }
  };

  const handleSaveCroppedImage = async (blob: Blob) => {
    if (croppingBannerIndex === null) return;
    const banner = banners[croppingBannerIndex];
    if (!banner) return;

    setUploading(banner.id);
    try {
      const file = new File([blob], `mobile-crop-${Date.now()}.webp`, { type: "image/webp" });
      const data = await readFileAsDataUrl(file);
      const res = await adminApi.uploadHeroBannerImage({ name: file.name, data });

      // Update state AND persist to DB in one go
      await publishUploadedImage(banner, croppingBannerIndex, "mobileImageUrl", res.url);
      toast.success("Mobile crop saved & published!");
    } catch (err) {
      toast.error("Failed to upload cropped image");
    } finally {
      setUploading(null);
      setCroppingBannerIndex(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[320px] items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading hero banners...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold dark:text-white">Hero Banners</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload, edit, reorder, hide, or delete the scrolling home hero banners.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadData} disabled={savingAll}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAdd} disabled={savingAll}>
            <Plus className="h-4 w-4" />
            Add Banner Slot
          </Button>
          <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Upload className="h-4 w-4" />
            Upload New Banner
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleUploadNewBanner}
              disabled={savingAll}
            />
          </label>
          <Button onClick={handleSaveAll} disabled={savingAll || banners.length === 0}>
            {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {banners.length === 0 && (
          <div className="border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-950">
            No banners yet. Add one and upload an image to publish it in the home hero slider.
          </div>
        )}

        {banners.map((banner, index) => {
          const isBusy = saving === banner.id || uploading === banner.id || savingAll;

          return (
            <section
              key={banner.id}
              className="border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-6"
            >
              <div className="mb-4 flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => moveBanner(index, -1)} disabled={index === 0 || isBusy}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => moveBanner(index, 1)}
                    disabled={index === banners.length - 1 || isBusy}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <span className="ml-1 font-semibold text-gray-950 dark:text-white">
                    Banner #{index + 1}
                    {banner.id < 0 ? " (Unsaved)" : ""}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      banner.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {banner.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {banner.isActive ? "Live" : "Hidden"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" onClick={() => handleDelete(index)} disabled={isBusy}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button onClick={() => handleSave(index)} disabled={isBusy}>
                    {saving === banner.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Banner
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Banner Image</Label>
                    <div className="relative aspect-[16/7] overflow-hidden border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
                      {banner.imageUrl ? (
                        <img src={banner.imageUrl} alt="Hero banner preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          Upload an image or paste an image URL
                        </div>
                      )}
                      {uploading === banner.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-medium text-white">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Uploading...
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
                      <Input
                        placeholder="/uploads/hero/banner.webp"
                        value={banner.imageUrl}
                        onChange={(event) => updateField(index, "imageUrl", event.target.value)}
                        disabled={isBusy}
                      />
                      <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-xs dark:bg-gray-950">
                        <Upload className="h-4 w-4" />
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => handleUploadImage(event, index, "imageUrl")}
                          disabled={isBusy}
                        />
                      </label>
                    </div>
                    

                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <input
                        type="checkbox"
                        checked={banner.isActive === 1}
                        onChange={(event) => updateField(index, "isActive", event.target.checked ? 1 : 0)}
                        className="h-4 w-4"
                        disabled={isBusy}
                      />
                      Active on home page
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <input
                        type="checkbox"
                        checked={banner.showText === 1}
                        onChange={(event) => updateField(index, "showText", event.target.checked ? 1 : 0)}
                        className="h-4 w-4"
                        disabled={isBusy}
                      />
                      Show text overlay
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <input
                        type="checkbox"
                        checked={banner.showButton === 1}
                        onChange={(event) => updateField(index, "showButton", event.target.checked ? 1 : 0)}
                        className="h-4 w-4"
                        disabled={isBusy}
                      />
                      Show shop button
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <input
                        type="checkbox"
                        checked={banner.darkOverlay === 1}
                        onChange={(event) => updateField(index, "darkOverlay", event.target.checked ? 1 : 0)}
                        className="h-4 w-4"
                        disabled={isBusy}
                      />
                      Black tone overlay
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Image Size Mode</Label>
                      <select
                        value={banner.imageFit || "cover"}
                        onChange={(event) => updateField(index, "imageFit", event.target.value)}
                        className="min-h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-gray-950"
                        disabled={isBusy}
                      >
                        <option value="cover">Crop to fill</option>
                        <option value="contain">Fit full image</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Desktop Crop Position</Label>
                      <select
                        value={banner.imagePosition || "center center"}
                        onChange={(event) => updateField(index, "imagePosition", event.target.value)}
                        className="min-h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-gray-950"
                        disabled={isBusy}
                      >
                        <option value="center center">Center</option>
                        <option value="left center">Left</option>
                        <option value="right center">Right</option>
                        <option value="center top">Top</option>
                        <option value="center bottom">Bottom</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile Version Crop</Label>
                      <div className="flex gap-2 items-center">
                         {banner.mobileImageUrl && (
                           <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border">
                             <img src={banner.mobileImageUrl} alt="Crop" className="h-full w-full object-cover" />
                           </div>
                         )}
                         <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           className="h-10"
                           onClick={() => setCroppingBannerIndex(index)}
                           disabled={isBusy || !banner.imageUrl}
                         >
                           {banner.mobileImageUrl ? "Recrop Mobile Image" : "Crop for Mobile"}
                         </Button>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        Select a specific area of the main image to show perfectly on mobile devices.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Product Name</Label>
                      <Input
                        value={banner.productName}
                        onChange={(event) => updateField(index, "productName", event.target.value)}
                        placeholder="Milky Way"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Product URL</Label>
                      <Input
                        value={banner.productUrl}
                        onChange={(event) => updateField(index, "productUrl", event.target.value)}
                        placeholder="/product/milky-way"
                        disabled={isBusy}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Subtitle / Eyebrow</Label>
                    <Input
                      value={banner.subtitle}
                      onChange={(event) => updateField(index, "subtitle", event.target.value)}
                      placeholder="EXTRAIT DE PARFUM - 50ML"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={banner.title}
                      onChange={(event) => updateField(index, "title", event.target.value)}
                      placeholder="Most Unique"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={banner.description}
                      onChange={(event) => updateField(index, "description", event.target.value)}
                      className="h-20"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Button Text</Label>
                      <Input
                        value={banner.buttonText}
                        onChange={(event) => updateField(index, "buttonText", event.target.value)}
                        placeholder="Shop Now Rs 499"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Shop Button URL (Fallback)</Label>
                      <Input
                        value={banner.buttonLink}
                        onChange={(event) => updateField(index, "buttonLink", event.target.value)}
                        placeholder="/product/milky-way"
                        disabled={isBusy}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Floating Badge</Label>
                    <Input
                      value={banner.badge}
                      onChange={(event) => updateField(index, "badge", event.target.value)}
                      placeholder="BEST SELLER"
                      disabled={isBusy}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {croppingBannerIndex !== null && banners[croppingBannerIndex]?.imageUrl && (
        <ImageCropperModal
          imageUrl={banners[croppingBannerIndex].imageUrl}
          title="Crop Mobile Image"
          description="Drag to select the area that will be visible on mobile devices."
          aspectRatio={3 / 4}
          onSave={handleSaveCroppedImage}
          onCancel={() => setCroppingBannerIndex(null)}
        />
      )}
    </AdminLayout>
  );
}
