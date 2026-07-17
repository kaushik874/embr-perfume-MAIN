import { useState } from "react";
import { Home, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Address } from "@/lib/api";

type AddressSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  addresses: Address[];
  selectedAddressId: number | null;
  onSelect: (address: Address) => void;
  onAddNew: () => void;
  onEdit: (address: Address) => void;
  onDelete: (id: number) => void;
};

export function AddressSelectionModal({
  isOpen,
  onClose,
  addresses,
  selectedAddressId,
  onSelect,
  onAddNew,
  onEdit,
  onDelete,
}: AddressSelectionModalProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  if (!isOpen) return null;

  // Filter out identical duplicates for display
  const uniqueAddresses: Address[] = [];
  const seen = new Set<string>();

  for (const addr of addresses) {
    const key = `${addr.full_name}|${addr.mobile}|${addr.email}|${addr.house_number}|${addr.street}|${addr.area}|${addr.city}|${addr.state}|${addr.pincode}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAddresses.push(addr);
    }
  }

  const toggleMenu = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => { onClose(); setOpenMenuId(null); }}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] w-full flex flex-col rounded-t-2xl bg-white shadow-2xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl border border-border-light">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="font-serif text-xl text-ink">Select delivery address</h2>
          <button
            onClick={() => { onClose(); setOpenMenuId(null); }}
            className="rounded-full p-1 text-ink-muted hover:bg-gray-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={() => {
              onAddNew();
              onClose();
              setOpenMenuId(null);
            }}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gold-deep bg-gold/5 px-4 py-3 text-gold-deep transition-colors hover:bg-gold/10"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium tracking-widest text-sm uppercase">Add New Address</span>
          </button>

          <div className="space-y-4">
            <h3 className="font-display text-xs tracking-[0.3em] text-gold-deep px-1">SAVED ADDRESSES</h3>
            {uniqueAddresses.map((address) => {
              const isSelected = address.id === selectedAddressId;
              const isMenuOpen = openMenuId === address.id;

              return (
                <div
                  key={address.id}
                  className={`relative flex items-start gap-4 rounded-xl border p-4 transition-colors ${
                    isSelected ? "border-gold-deep bg-gold/5 shadow-sm" : "border-border-light hover:border-gold/40"
                  }`}
                  onClick={() => {
                    if (openMenuId !== null) { setOpenMenuId(null); return; }
                    onSelect(address);
                    onClose();
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Home className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{address.full_name}</p>
                      {isSelected && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 uppercase tracking-widest">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-muted leading-snug">
                      {[
                        address.house_number,
                        address.street,
                        address.area,
                        address.city,
                        address.state,
                        address.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">{address.mobile}</p>
                  </div>

                  {/* 3-dots button + dropdown menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => toggleMenu(e, address.id)}
                      className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-ink"
                      aria-label="Address options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-9 z-10 min-w-[140px] rounded-lg border border-border-light bg-white py-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(address);
                            onClose();
                            setOpenMenuId(null);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-gold-deep" />
                          Edit
                        </button>
                        <button
                          className="flex w-full items-center gap-2 border-t border-border-light px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(address.id);
                            setOpenMenuId(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

