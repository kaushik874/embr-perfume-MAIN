import { useEffect, useState } from "react";
import { adminApi, HeroBanner } from "@/lib/api";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2, Plus, Save } from "lucide-react";
import { FooterManager } from "./FooterManager";

const TABS = [
  { id: "hero", label: "Hero" },
  { id: "collection", label: "Collection & Shop", sectionKey: "section_collection" },
  { id: "banner", label: "Feature Banner", sectionKey: "section_banner" },
  { id: "trust", label: "Trust Strip", sectionKey: "section_trust" },
  { id: "story", label: "Brand Story", sectionKey: "section_story" },
  { id: "promo", label: "Promo Bar", sectionKey: "section_promo" },
  { id: "footer", label: "Header & Footer" },
  { id: "faq", label: "FAQ" },
  { id: "legal", label: "Legal Pages" },
  { id: "custom", label: "Custom Keys" }
];

export function AdminContent() {
  const [content, setContent] = useState<Record<string, string>>({});
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("hero");

  // Custom key form
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const loadData = async () => {
    try {
      const [{ content: c }, { sections: s }, { banners }] = await Promise.all([
        adminApi.getContent(),
        adminApi.getSections(),
        adminApi.getHeroBanners()
      ]);
      setContent(c);
      setHeroBanners(banners.map((banner, index) => ({
        ...banner,
        title: banner.title ?? "",
        subtitle: banner.subtitle ?? "",
        description: banner.description ?? "",
        imageUrl: banner.imageUrl ?? "",
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
      })));
      // convert array of {key, hidden} to Record<string, boolean>
      const secMap: Record<string, boolean> = {};
      s.forEach(x => secMap[x.key] = x.hidden === 1);
      setSections(secMap);
    } catch {
      toast.error("Failed to load CMS data");
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleChange = (k: string, v: string) => setContent(prev => ({ ...prev, [k]: v }));

  const buildHeroBannerFromContent = (imageUrl: string, order = heroBanners.length) => {
    const title = [content.hero_title_line1, content.hero_title_em].filter(Boolean).join(" ").trim() || "New Banner";
    const productUrl = content.hero_product_link || "/collections";
    return {
      title,
      subtitle: content.hero_eyebrow || "",
      description: content.hero_desc || "",
      imageUrl,
      productName: title,
      productUrl,
      badge: content.hero_badge || "",
      buttonText: content.hero_btn_primary || "Shop Now",
      buttonLink: productUrl,
      showButton: 1,
      darkOverlay: 0,
      imageFit: "cover",
      imagePosition: "center center",
      mobileImagePosition: "center center",
      showText: 1,
      isActive: 1,
      displayOrder: order,
    };
  };

  const handleSave = async (k: string) => {
    setBusy(k);
    try {
      await adminApi.updateContent(k, content[k] || "");
      if (k === "hero_image" && content[k]) {
        const res = await adminApi.createHeroBanner(buildHeroBannerFromContent(content[k]));
        const { banners } = await adminApi.getHeroBanners();
        setHeroBanners(banners);
        toast.success(`Hero banner added to slider #${res.id}`);
      } else {
        toast.success("Updated Successfully");
      }
    } catch {
      toast.error("Failed to update");
    }
    setBusy(null);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(key);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = key === "hero_image"
            ? await adminApi.uploadHeroBannerImage({ name: file.name, data: reader.result as string })
            : await adminApi.uploadContentFile({ name: file.name, data: reader.result as string });
          await adminApi.updateContent(key, res.url);
          setContent(prev => ({ ...prev, [key]: res.url }));
          if (key === "hero_image") {
            const created = await adminApi.createHeroBanner(buildHeroBannerFromContent(res.url));
            const { banners } = await adminApi.getHeroBanners();
            setHeroBanners(banners);
            toast.success(`Hero banner uploaded and added to slider #${created.id}`);
          } else {
            toast.success("Image uploaded successfully");
          }
        } catch {
          toast.error("Failed to upload image");
        }
        setBusy(null);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Error reading file");
      setBusy(null);
    }
  };

  const handleToggleSection = async (key: string) => {
    const isHidden = sections[key] === true;
    if (!isHidden) {

    }
    
    try {
      await adminApi.updateSection(key, !isHidden);
      setSections(prev => ({ ...prev, [key]: !isHidden }));
      toast.success(`Section ${!isHidden ? "hidden" : "visible"}`);
    } catch {
      toast.error("Failed to update section visibility");
    }
  };

  const handleDelete = async (k: string) => {

    try {
      await adminApi.deleteContent(k);
      setContent(prev => { delete prev[k]; return { ...prev }; });
      toast.success("Deleted successfully");
    } catch {
      toast.error("Delete failed");
    }
  };

  const updateHeroBannerField = <K extends keyof HeroBanner>(index: number, field: K, value: HeroBanner[K]) => {
    setHeroBanners(prev => prev.map((banner, i) => i === index ? { ...banner, [field]: value } : banner));
  };

  const saveHeroBanner = async (index: number) => {
    const banner = heroBanners[index];
    if (!banner) return;
    if (!banner.imageUrl) {
      toast.error("Banner image is required");
      return;
    }

    setBusy(`hero-banner-${banner.id}`);
    try {
      await adminApi.updateHeroBanner(banner.id, {
        ...banner,
        displayOrder: index,
        showButton: banner.showButton ? 1 : 0,
        darkOverlay: banner.darkOverlay ? 1 : 0,
        imageFit: banner.imageFit || "cover",
        imagePosition: banner.imagePosition || "center center",
        mobileImagePosition: banner.mobileImagePosition || "center center",
        showText: banner.showText ? 1 : 0,
        isActive: banner.isActive ? 1 : 0,
      });
      toast.success("Hero banner updated");
    } catch {
      toast.error("Failed to update hero banner");
    }
    setBusy(null);
  };

  const deleteHeroBanner = async (index: number) => {
    const banner = heroBanners[index];
    if (!banner) return;

    setBusy(`hero-banner-${banner.id}`);
    try {
      await adminApi.deleteHeroBanner(banner.id);
      const next = heroBanners.filter((_, i) => i !== index);
      setHeroBanners(next);
      await adminApi.reorderHeroBanners(next.map((item, i) => ({ id: item.id, displayOrder: i })));
      toast.success("Hero banner deleted");
    } catch {
      toast.error("Failed to delete hero banner");
    }
    setBusy(null);
  };

  const currentTabObj = TABS.find(t => t.id === activeTab);

  const renderField = (key: string, label: string, isTextarea = false, isImage = false) => (
    <div className="space-y-2 relative" key={key}>
      <Label className="text-gray-700 dark:text-gray-300 font-medium flex justify-between">
        {label} <span className="text-xs text-gray-400 font-mono font-normal">[{key}]</span>
      </Label>
      {isImage ? (
        <div className="flex flex-col gap-2 border p-4 rounded-md dark:border-gray-800">
          {content[key] && (
            <img src={content[key]} alt="Preview" className="h-32 w-auto object-contain bg-gray-100 dark:bg-gray-900 rounded" />
          )}
          <div className="flex gap-2">
            <Input 
              type="file" 
              accept="image/*"
              onChange={(e) => handleUploadImage(e, key)} 
              className="flex-1"
            />
            <Input 
              value={content[key] || ""} 
              onChange={(e) => handleChange(key, e.target.value)} 
              placeholder="Or enter URL directly"
              className="flex-1" 
            />
            <Button onClick={() => handleSave(key)} disabled={busy === key} size="sm">
              {busy === key ? "..." : "Save URL"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-start">
          {isTextarea ? (
            <Textarea 
              value={content[key] || ""} 
              onChange={(e) => handleChange(key, e.target.value)} 
              className="flex-1 min-h-[100px] font-sans" 
            />
          ) : (
            <Input 
              value={content[key] || ""} 
              onChange={(e) => handleChange(key, e.target.value)} 
              className="flex-1" 
            />
          )}
          <Button onClick={() => handleSave(key)} disabled={busy === key} size="sm">
            {busy === key ? "..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">Content System</h1>
        <a href="/" target="_blank" rel="noreferrer" className="text-sm font-medium text-gold-deep hover:underline">
          Live Preview ↗
        </a>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Tabs sidebar */}
        <div className="w-full md:w-64 flex flex-col gap-1 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-left rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id 
                  ? "bg-black dark:bg-white text-white dark:text-black" 
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
              {t.sectionKey && (
                <span className="float-right mt-0.5">
                  {sections[t.sectionKey] ? <EyeOff className="w-4 h-4 opacity-50 text-red-500" /> : <Eye className="w-4 h-4 opacity-50" />}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* CMS Editor Area */}
        <div className="flex-1 w-full bg-white dark:bg-gray-950 p-6 sm:p-8 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          
          {currentTabObj?.sectionKey && (
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-between border border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Section Visibility</h3>
                <p className="text-sm text-gray-500 mt-1">If hidden, this entire section will be removed from the live website immediately.</p>
              </div>
              <Button 
                variant={sections[currentTabObj.sectionKey] ? "default" : "outline"}
                className={sections[currentTabObj.sectionKey] ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                onClick={() => handleToggleSection(currentTabObj.sectionKey!)}
              >
                {sections[currentTabObj.sectionKey] ? <><Eye className="w-4 h-4 mr-2"/> Show Section</> : <><EyeOff className="w-4 h-4 mr-2"/> Hide Section</>}
              </Button>
            </div>
          )}

          <div className="space-y-8">
            {activeTab === "hero" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Hero Section</h2>
                {renderField("hero_image", "Hero Background / Bottle Image", false, true)}
                {renderField("hero_product_link", "Shop Now Link (e.g. /product/milky-way)")}
                {renderField("hero_eyebrow", "Eyebrow Text (Small Gold Text)")}
                {renderField("hero_title_line1", "Title Line 1")}
                {renderField("hero_title_em", "Title Line 2 (Italic Gold)")}
                {renderField("hero_desc", "Description Subtitle", true)}
                {renderField("hero_badge", "Floating Bottle Badge")}
                {renderField("hero_btn_primary", "Primary Button Text")}
                {renderField("hero_btn_secondary", "Secondary Button Text")}

                <div className="border-t pt-6 dark:border-gray-800">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-serif font-bold dark:text-white">Live Hero Slider Banners</h3>
                      <p className="text-sm text-gray-500">Images uploaded above are added here and shown on the website slider.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadData}>
                      Refresh
                    </Button>
                  </div>

                  <div className="space-y-5">
                    {heroBanners.length === 0 && (
                      <div className="border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-800">
                        No hero banners yet. Upload an image above to add the first banner.
                      </div>
                    )}

                    {heroBanners.map((banner, index) => (
                      <div key={banner.id} className="border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            Banner #{index + 1} {banner.isActive ? "(Live)" : "(Hidden)"}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveHeroBanner(index)}
                              disabled={busy === `hero-banner-${banner.id}`}
                            >
                              <Save className="h-4 w-4" />
                              Save
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteHeroBanner(index)}
                              disabled={busy === `hero-banner-${banner.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
                          <div className="space-y-3">
                            <div className="aspect-[16/7] overflow-hidden bg-gray-200 dark:bg-gray-950">
                              <img src={banner.imageUrl} alt="Hero banner" className="h-full w-full object-cover" />
                            </div>
                            <Input
                              value={banner.imageUrl || ""}
                              onChange={(e) => updateHeroBannerField(index, "imageUrl", e.target.value)}
                              placeholder="/uploads/hero/banner.webp"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={banner.isActive === 1}
                                  onChange={(e) => updateHeroBannerField(index, "isActive", e.target.checked ? 1 : 0)}
                                />
                                Active on website
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={banner.showText === 1}
                                  onChange={(e) => updateHeroBannerField(index, "showText", e.target.checked ? 1 : 0)}
                                />
                                Show text
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={banner.showButton === 1}
                                  onChange={(e) => updateHeroBannerField(index, "showButton", e.target.checked ? 1 : 0)}
                                />
                                Show shop button
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={banner.darkOverlay === 1}
                                  onChange={(e) => updateHeroBannerField(index, "darkOverlay", e.target.checked ? 1 : 0)}
                                />
                                Black tone overlay
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="space-y-1">
                                <Label>Image Size</Label>
                                <select
                                  value={banner.imageFit || "cover"}
                                  onChange={(e) => updateHeroBannerField(index, "imageFit", e.target.value)}
                                  className="min-h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-gray-950"
                                >
                                  <option value="cover">Crop to fill</option>
                                  <option value="contain">Fit full image</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label>Desktop Crop</Label>
                                <select
                                  value={banner.imagePosition || "center center"}
                                  onChange={(e) => updateHeroBannerField(index, "imagePosition", e.target.value)}
                                  className="min-h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-gray-950"
                                >
                                  <option value="center center">Center</option>
                                  <option value="left center">Left</option>
                                  <option value="right center">Right</option>
                                  <option value="center top">Top</option>
                                  <option value="center bottom">Bottom</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label>Mobile Crop</Label>
                                <select
                                  value={banner.mobileImagePosition || "center center"}
                                  onChange={(e) => updateHeroBannerField(index, "mobileImagePosition", e.target.value)}
                                  className="min-h-9 w-full rounded-md border bg-white px-3 text-sm dark:bg-gray-950"
                                >
                                  <option value="center center">Center</option>
                                  <option value="left center">Left</option>
                                  <option value="right center">Right</option>
                                  <option value="center top">Top</option>
                                  <option value="center bottom">Bottom</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Product Name</Label>
                                <Input
                                  value={banner.productName || ""}
                                  onChange={(e) => updateHeroBannerField(index, "productName", e.target.value)}
                                  placeholder="Milky Way"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Product URL</Label>
                                <Input
                                  value={banner.productUrl || ""}
                                  onChange={(e) => updateHeroBannerField(index, "productUrl", e.target.value)}
                                  placeholder="/product/milky-way"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label>Title</Label>
                              <Input
                                value={banner.title || ""}
                                onChange={(e) => updateHeroBannerField(index, "title", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Subtitle</Label>
                              <Input
                                value={banner.subtitle || ""}
                                onChange={(e) => updateHeroBannerField(index, "subtitle", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Description</Label>
                              <Textarea
                                value={banner.description || ""}
                                onChange={(e) => updateHeroBannerField(index, "description", e.target.value)}
                                className="min-h-20"
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Button Text</Label>
                                <Input
                                  value={banner.buttonText || ""}
                                  onChange={(e) => updateHeroBannerField(index, "buttonText", e.target.value)}
                                  placeholder="Shop Now"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Badge</Label>
                                <Input
                                  value={banner.badge || ""}
                                  onChange={(e) => updateHeroBannerField(index, "badge", e.target.value)}
                                  placeholder="BEST SELLER"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "collection" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Collection Showcase</h2>
                {renderField("collection_eyebrow", "Eyebrow Text")}
                {renderField("collection_heading", "Main Heading")}
              </>
            )}

            {activeTab === "banner" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Feature Banner (Milky Way)</h2>
                {renderField("banner_eyebrow", "Eyebrow Text")}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">{renderField("banner_title1", "Title Part 1")}</div>
                  <div className="col-span-1">{renderField("banner_em", "Title Em (Gold)")}</div>
                  <div className="col-span-1">{renderField("banner_title2", "Title Part 3")}</div>
                </div>
                {renderField("banner_desc", "Banner Description", true)}
                {renderField("banner_btn", "Primary Button Text")}
                {renderField("banner_badge", "Floating Bottle Badge")}
              </>
            )}

            {activeTab === "trust" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Trust Strip (4 Items)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("trust_1_title", "Item 1 - Title")}
                    {renderField("trust_1_sub", "Item 1 - Subtext")}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("trust_2_title", "Item 2 - Title")}
                    {renderField("trust_2_sub", "Item 2 - Subtext")}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("trust_3_title", "Item 3 - Title")}
                    {renderField("trust_3_sub", "Item 3 - Subtext")}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("trust_4_title", "Item 4 - Title")}
                    {renderField("trust_4_sub", "Item 4 - Subtext")}
                  </div>
                </div>
              </>
            )}

            {activeTab === "story" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Brand Story Section</h2>

                {/* ── Hero Image Banner ── */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-50">Full-Screen Image Mode</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        When ON — the section shows as a full-bleed hero banner (like the homepage hero).
                        When OFF — shows the original card layout below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const current = content["story_show_bg_image"] === "1";
                        const next = current ? "0" : "1";
                        handleChange("story_show_bg_image", next);
                        await adminApi.updateContent("story_show_bg_image", next);
                        toast.success(next === "1" ? "Hero mode ON" : "Hero mode OFF");
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        content["story_show_bg_image"] === "1" ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          content["story_show_bg_image"] === "1" ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Image preview */}
                  {content["story_image"] ? (
                    <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900" style={{ height: 220 }}>
                      <img src={content["story_image"]} alt="Story banner" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-end p-4">
                        <p className="text-white text-sm font-medium drop-shadow">Banner Image Preview</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <p className="text-sm text-gray-400">No image yet — upload one below</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 items-center">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(e, "story_image")}
                      />
                      <span className={`inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${busy === "story_image" ? "opacity-50 pointer-events-none" : ""}`}>
                        {busy === "story_image" ? "Uploading..." : "📤 Upload Image"}
                      </span>
                    </label>
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={content["story_image"] || ""}
                        onChange={(e) => handleChange("story_image", e.target.value)}
                        placeholder="or paste image URL"
                        className="text-sm"
                      />
                      <Button size="sm" onClick={() => handleSave("story_image")} disabled={busy === "story_image"}>
                        Save URL
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Dark Overlay</p>
                      <p className="text-xs text-gray-500">Makes text more readable on bright images</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const current = content["story_dark_overlay"] === "0";
                        const next = current ? "1" : "0";
                        handleChange("story_dark_overlay", next);
                        await adminApi.updateContent("story_dark_overlay", next);
                      }}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        content["story_dark_overlay"] !== "0" ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${content["story_dark_overlay"] !== "0" ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>

                {/* Optional CTA Button (hero mode) */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 dark:text-gray-50">CTA Button (hero mode only)</p>
                    <button
                      type="button"
                      onClick={async () => {
                        const current = content["story_show_button"] === "1";
                        const next = current ? "0" : "1";
                        handleChange("story_show_button", next);
                        await adminApi.updateContent("story_show_button", next);
                      }}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        content["story_show_button"] === "1" ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${content["story_show_button"] === "1" ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                  {content["story_show_button"] === "1" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {renderField("story_btn_text", "Button Text")}
                      {renderField("story_btn_link", "Button Link")}
                    </div>
                  )}
                </div>

                {/* Text fields */}
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4">Text Content</h3>
                {renderField("story_eyebrow", "Section Eyebrow")}
                {renderField("story_heading", "Main Heading")}
                {renderField("story_em", "Main Heading Italic (Gold)")}
                {renderField("story_body1", "First Paragraph", true)}
                {renderField("story_body2", "Second Paragraph", true)}
                
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mt-8 mb-4">Floating Info Card <span className="font-normal text-xs text-gray-400">(original layout only)</span></h3>
                {renderField("story_card_eyebrow", "Card Eyebrow")}
                {renderField("story_card_title", "Card Title")}
                {renderField("story_card_em", "Card Title Italic")}
                {renderField("story_card_footer", "Card Footer Subtext")}

                <h3 className="font-bold text-gray-700 dark:text-gray-300 mt-8 mb-4">Stats Grid <span className="font-normal text-xs text-gray-400">(original layout only)</span></h3>
                <div className="grid grid-cols-2 gap-4">
                  {renderField("story_stat_1_n", "Stat 1 Number")}
                  {renderField("story_stat_1_l", "Stat 1 Label")}
                  {renderField("story_stat_2_n", "Stat 2 Number")}
                  {renderField("story_stat_2_l", "Stat 2 Label")}
                  {renderField("story_stat_3_n", "Stat 3 Number")}
                  {renderField("story_stat_3_l", "Stat 3 Label")}
                  {renderField("story_stat_4_n", "Stat 4 Number")}
                  {renderField("story_stat_4_l", "Stat 4 Label")}
                </div>
              </>
            )}


            {activeTab === "promo" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Promo Bar Settings</h2>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-50">Enable Promo Bar</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Show a promotional bar at the very top of the site (across all pages).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSection("section_promo")}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        !sections["section_promo"] ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${!sections["section_promo"] ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                  {!sections["section_promo"] && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      {renderField("promo_banner", "Promo Text (e.g., Free shipping on orders above ₹999)")}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "footer" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Header & Global</h2>
                
                {/* Logo Upload */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-5 mb-6 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">Global Site Logo (Image)</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Upload a custom logo image. If empty, the text "Site Name" below will be used instead.
                    </p>
                  </div>

                  {content["site_logo"] ? (
                    <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4" style={{ height: 120 }}>
                      <img src={content["site_logo"]} alt="Site logo" className="max-h-full object-contain" />
                      <button
                        onClick={() => {
                          handleChange("site_logo", "");
                          handleSave("site_logo");
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <p className="text-sm text-gray-400">No logo uploaded — using text fallback</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 items-center">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(e, "site_logo")}
                      />
                      <span className={`inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${busy === "site_logo" ? "opacity-50 pointer-events-none" : ""}`}>
                        {busy === "site_logo" ? "Uploading..." : "📤 Upload Logo"}
                      </span>
                    </label>
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={content["site_logo"] || ""}
                        onChange={(e) => handleChange("site_logo", e.target.value)}
                        placeholder="or paste image URL"
                        className="text-sm"
                      />
                      <Button size="sm" onClick={() => handleSave("site_logo")} disabled={busy === "site_logo"}>
                        Save URL
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* End of Logo Upload */}

                {renderField("site_name", "Global Site Name (Text Fallback for Logo)")}
                
                <h2 className="text-xl font-serif font-bold border-b pb-2 pt-6 mb-4 dark:border-gray-800">Footer Text</h2>
                {renderField("footer_tagline", "Large Tagline", true)}
                {renderField("footer_copyright", "Copyright Text")}
                {renderField("footer_slogan", "Slogan Text")}

                <h2 className="text-xl font-serif font-bold border-b pb-2 pt-8 mb-4 dark:border-gray-800">Footer Links & Columns</h2>
                <FooterManager />
              </>
            )}

            {activeTab === "faq" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">FAQ Page Content</h2>
                {renderField("faq_eyebrow", "Page Eyebrow")}
                {renderField("faq_title", "Page Title")}
                <div className="space-y-6 mt-6">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("faq_q1", "Question 1")}
                    {renderField("faq_a1", "Answer 1", true)}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("faq_q2", "Question 2")}
                    {renderField("faq_a2", "Answer 2", true)}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
                    {renderField("faq_q3", "Question 3")}
                    {renderField("faq_a3", "Answer 3", true)}
                  </div>
                </div>
              </>
            )}

            {activeTab === "legal" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Legal & Info Pages</h2>
                
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mt-6 mb-4">Shipping Information</h3>
                {renderField("page_shipping", "Shipping Content", true)}
                
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mt-8 mb-4">Return Policy</h3>
                {renderField("page_returns", "Returns Content", true)}
                
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mt-8 mb-4">Privacy Policy</h3>
                {renderField("page_policy", "Policy Content", true)}
              </>
            )}

            {activeTab === "custom" && (
              <>
                <h2 className="text-xl font-serif font-bold border-b pb-2 mb-4 dark:border-gray-800">Advanced / Custom Keys</h2>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-6">
                  Warning: Modifying keys that aren't mapped in the frontend won't have any visible effect. Delete unused keys here.
                </div>

                <div className="space-y-3 mb-8">
                  {Object.entries(content).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                      <div className="w-1/3 shrink-0 font-mono text-xs text-blue-600 dark:text-blue-400 break-all pt-2.5">
                        {k}
                      </div>
                      <div className="flex-1 flex gap-2">
                        <Input 
                          value={v} 
                          onChange={(e) => handleChange(k, e.target.value)} 
                          className="font-mono text-xs" 
                        />
                        <Button variant="outline" size="sm" onClick={() => handleSave(k)} disabled={busy === k}>
                          Save
                        </Button>
                        <Button variant="destructive" size="icon" className="shrink-0" onClick={() => handleDelete(k)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(content).length === 0 && <p className="text-sm text-gray-500">No custom keys created.</p>}
                </div>

                <h3 className="font-bold text-gray-700 dark:text-gray-300 pt-6 border-t dark:border-gray-800 mb-4">Add New Key</h3>
                <div className="flex items-end gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Key Name</Label>
                    <Input placeholder="e.g. holiday_banner_text" value={newKey} onChange={e => setNewKey(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input placeholder="e.g. Free shipping this weekend!" value={newVal} onChange={e => setNewVal(e.target.value)} />
                  </div>
                  <Button 
                    className="shrink-0 gap-2"
                    disabled={!newKey || !newVal || busy === 'new'} 
                    onClick={async () => {
                      setBusy('new');
                      try {
                        await adminApi.updateContent(newKey, newVal);
                        setContent(prev => ({...prev, [newKey]: newVal}));
                        setNewKey(""); setNewVal("");
                        toast.success("Added new key");
                      } catch {
                        toast.error("Failed to add");
                      }
                      setBusy(null);
                    }}
                  >
                    <Plus className="w-4 h-4"/> Add Route
                  </Button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
