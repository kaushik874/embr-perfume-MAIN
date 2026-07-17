import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Save, Upload } from "lucide-react";

type AboutBanner = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  showText: number;
  isActive: number;
  darkOverlay: number;
  buttonText: string;
  buttonLink: string;
  showButton: number;
};

const defaultBanner: AboutBanner = {
  id: 1,
  title: "Our Story",
  subtitle: "Crafted in shadow. Worn in light.",
  description:
    "Embr began in a small atelier on the edge of a cedar forest. We believed fragrance should be felt before it is smelled — a presence, a memory, a whisper that lingers long after you have left the room.",
  imageUrl: "",
  showText: 1,
  isActive: 1,
  darkOverlay: 1,
  buttonText: "",
  buttonLink: "",
  showButton: 0,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

export function AdminAbout() {
  const [banner, setBanner] = useState<AboutBanner>(defaultBanner);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminApi.getAboutBannerAdmin()
      .then((res) => {
        if (res.banner) {
          setBanner({ ...defaultBanner, ...res.banner });
        }
      })
      .catch(() => toast.error("Failed to load About page settings"))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof AboutBanner>(field: K, value: AboutBanner[K]) => {
    setBanner((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      const res = await adminApi.uploadAboutBannerImage({ name: file.name, data });
      update("imageUrl", res.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateAboutBanner(banner);
      toast.success("About page settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Our Story Page</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure the banner image and text shown on the /about page.
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        {/* Active Toggle */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-50">Page Visibility</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                When off, the /about page will show a simple blank page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update("isActive", banner.isActive ? 0 : 1)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                banner.isActive ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  banner.isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Banner Image */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 space-y-4">
          <h2 className="font-medium text-gray-900 dark:text-gray-50">Banner Image</h2>

          {banner.imageUrl ? (
            <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900" style={{ height: 240 }}>
              <img
                src={banner.imageUrl}
                alt="About banner preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-end p-4">
                {banner.showText ? (
                  <div className={`text-white ${banner.darkOverlay ? "drop-shadow-lg" : ""}`}>
                    <p className="text-xs tracking-widest uppercase opacity-70">— OUR STORY</p>
                    <p className="mt-1 font-serif text-xl">{banner.title || "Our Story"}</p>
                    <p className="text-sm opacity-80 italic">{banner.subtitle}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-sm text-gray-400">No image set — upload one below</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload Image"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
            {banner.imageUrl && (
              <div className="flex-1">
                <Input
                  value={banner.imageUrl}
                  onChange={(e) => update("imageUrl", e.target.value)}
                  placeholder="Or paste image URL"
                  className="text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Dark Overlay</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Darkens image so text is readable</p>
              </div>
              <button
                type="button"
                onClick={() => update("darkOverlay", banner.darkOverlay ? 0 : 1)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  banner.darkOverlay ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${banner.darkOverlay ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Show Text</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Display title/subtitle on the banner</p>
              </div>
              <button
                type="button"
                onClick={() => update("showText", banner.showText ? 0 : 1)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  banner.showText ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${banner.showText ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 space-y-4">
          <h2 className="font-medium text-gray-900 dark:text-gray-50">Text Content</h2>
          <div>
            <Label htmlFor="about-eyebrow">Eyebrow label (small text above title)</Label>
            <Input
              id="about-eyebrow"
              value={banner.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Our Story"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="about-subtitle">Main Headline / Subtitle</Label>
            <Input
              id="about-subtitle"
              value={banner.subtitle}
              onChange={(e) => update("subtitle", e.target.value)}
              placeholder="Crafted in shadow. Worn in light."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="about-description">Body Text</Label>
            <Textarea
              id="about-description"
              value={banner.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Tell your brand story..."
              rows={4}
              className="mt-1"
            />
          </div>
        </div>

        {/* Button (optional) */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900 dark:text-gray-50">Call-to-Action Button</h2>
            <button
              type="button"
              onClick={() => update("showButton", banner.showButton ? 0 : 1)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                banner.showButton ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${banner.showButton ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
          {banner.showButton ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="about-btntext">Button Text</Label>
                <Input
                  id="about-btntext"
                  value={banner.buttonText}
                  onChange={(e) => update("buttonText", e.target.value)}
                  placeholder="Explore Collection"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="about-btnlink">Button Link</Label>
                <Input
                  id="about-btnlink"
                  value={banner.buttonLink}
                  onChange={(e) => update("buttonLink", e.target.value)}
                  placeholder="/collections"
                  className="mt-1"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Toggle on to add a button to the banner.</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
