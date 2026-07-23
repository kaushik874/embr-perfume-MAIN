import { useState, useEffect } from "react";
import { adminApi, FooterColumn, FooterLink } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Save, Edit2 } from "lucide-react";

export function FooterManager() {
  const [columns, setColumns] = useState<FooterColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFooter = async () => {
    try {
      const res = await adminApi.getFooterAdmin();
      setColumns(res.columns);
    } catch {
      toast.error("Failed to load footer data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFooter();
  }, []);

  const handleAddColumn = async () => {
    const title = prompt("Enter new column title:");
    if (!title) return;
    try {
      const res = await adminApi.createFooterColumn(title);
      setColumns((prev) => [...prev, res.column]);
      toast.success("Column added");
    } catch {
      toast.error("Failed to add column");
    }
  };

  const handleEditColumn = async (id: number, currentTitle: string) => {
    const title = prompt("Edit column title:", currentTitle);
    if (!title || title === currentTitle) return;
    try {
      await adminApi.updateFooterColumn(id, { title });
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      toast.success("Column updated");
    } catch {
      toast.error("Failed to update column");
    }
  };

  const handleDeleteColumn = async (id: number) => {

    try {
      await adminApi.deleteFooterColumn(id);
      setColumns((prev) => prev.filter((c) => c.id !== id));
      toast.success("Column deleted");
    } catch {
      toast.error("Failed to delete column");
    }
  };

  const handleAddLink = async (column_id: number) => {
    const label = prompt("Enter link label:");
    if (!label) return;
    const url = prompt("Enter link URL:", "/");
    if (!url) return;
    
    try {
      const res = await adminApi.createFooterLink({ column_id, label, url });
      setColumns((prev) =>
        prev.map((c) =>
          c.id === column_id ? { ...c, links: [...c.links, res.link] } : c
        )
      );
      toast.success("Link added");
    } catch {
      toast.error("Failed to add link");
    }
  };

  const handleEditLink = async (link: FooterLink) => {
    const label = prompt("Edit link label:", link.label);
    if (label === null) return;
    const url = prompt("Edit link URL:", link.url);
    if (url === null) return;
    
    if (label === link.label && url === link.url) return;

    try {
      await adminApi.updateFooterLink(link.id, { label, url });
      setColumns((prev) =>
        prev.map((c) =>
          c.id === link.column_id
            ? {
                ...c,
                links: c.links.map((l) =>
                  l.id === link.id ? { ...l, label, url } : l
                ),
              }
            : c
        )
      );
      toast.success("Link updated");
    } catch {
      toast.error("Failed to update link");
    }
  };

  const handleDeleteLink = async (link: FooterLink) => {

    try {
      await adminApi.deleteFooterLink(link.id);
      setColumns((prev) =>
        prev.map((c) =>
          c.id === link.column_id
            ? { ...c, links: c.links.filter((l) => l.id !== link.id) }
            : c
        )
      );
      toast.success("Link deleted");
    } catch {
      toast.error("Failed to delete link");
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading footer data...</div>;
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Dynamic Footer Columns</h3>
        <Button onClick={handleAddColumn} size="sm" className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Column
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-black">
            {/* Column Header */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h4 className="font-display text-sm tracking-widest text-gold-deep">{col.title}</h4>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:text-blue-600"
                  onClick={() => handleEditColumn(col.id, col.title)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:text-red-600"
                  onClick={() => handleDeleteColumn(col.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Links List */}
            <div className="p-4 space-y-2">
              {col.links.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-2">No links added</p>
              ) : (
                col.links.map((link) => (
                  <div key={link.id} className="flex flex-col gap-1 p-2 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {link.label}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-blue-600"
                          onClick={() => handleEditLink(link)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-600"
                          onClick={() => handleDeleteLink(link)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[200px]" title={link.url}>
                      {link.url}
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs border-dashed border-gray-300 dark:border-gray-700"
                onClick={() => handleAddLink(col.id)}
              >
                <Plus className="w-3 h-3 mr-1" /> Add Link
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
