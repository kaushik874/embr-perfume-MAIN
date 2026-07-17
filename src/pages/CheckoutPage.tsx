import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Building2, Plus, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Address } from "@/lib/api";
import { saveCheckoutShipping } from "@/lib/checkout-storage";
import { AddressSelectionModal } from "@/components/checkout/AddressSelectionModal";

type ShippingForm = {
  name: string;
  email: string;
  phone: string;
  houseNumber: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  alternatePhone: string;
  companyName: string;
};

const emptyShipping: ShippingForm = {
  name: "",
  email: "",
  phone: "",
  houseNumber: "",
  street: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
  alternatePhone: "",
  companyName: "",
};

function addressToShipping(address: Address): ShippingForm {
  return {
    name: address.full_name,
    email: address.email,
    phone: address.mobile,
    houseNumber: address.house_number,
    street: address.street,
    area: address.area,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    landmark: address.landmark ?? "",
    alternatePhone: address.alternate_mobile ?? "",
    companyName: address.company_name ?? "",
  };
}

function formatAddress(address: Address) {
  return [
    address.company_name,
    address.house_number,
    address.street,
    address.area,
    address.landmark ? `Landmark: ${address.landmark}` : "",
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function validateShipping(form: ShippingForm) {
  const errors: Partial<Record<keyof ShippingForm, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Enter full name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter valid email";
  if (!/^[0-9+\-\s]{10,15}$/.test(form.phone.trim())) errors.phone = "Enter valid mobile number";
  if (!form.houseNumber.trim()) errors.houseNumber = "House or flat number is required";
  if (form.street.trim().length < 2) errors.street = "Street is required";
  if (form.area.trim().length < 2) errors.area = "Area is required";
  if (form.city.trim().length < 2) errors.city = "City is required";
  if (form.state.trim().length < 2) errors.state = "State is required";
  if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim())) errors.pincode = "Enter valid 6 digit PIN code";
  if (form.alternatePhone && !/^[0-9+\-\s]{10,15}$/.test(form.alternatePhone.trim())) {
    errors.alternatePhone = "Enter valid alternate mobile number";
  }
  return errors;
}

export function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, syncProducts } = useCart();
  const [, setLocation] = useLocation();
  const [shipping, setShipping] = useState<ShippingForm>(emptyShipping);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [setDefault, setSetDefault] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({});
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  useEffect(() => {
    if (items.length === 0) setLocation("/cart");
  }, [items.length, setLocation]);

  useEffect(() => {
    void syncProducts();
  }, [syncProducts]);

  useEffect(() => {
    if (!user) return;
    setShipping((current) => ({
      ...current,
      name: current.name || user.name || "",
      email: current.email || user.email || "",
      phone: current.phone || user.phone || "",
    }));
    api.addresses()
      .then((res) => {
        const sorted = [...res.addresses].sort((a, b) => b.id - a.id);
        setAddresses(sorted);
        const preferred = sorted.find((a) => a.is_default) ?? sorted[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setShipping(addressToShipping(preferred));
        }
      })
      .catch(() => {});
  }, [user]);

  const update = (field: keyof ShippingForm, value: string) => {
    setShipping((s) => ({ ...s, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
    setEditingAddressId(null);
    setSelectedAddressId(null);
  };

  const selectAddress = (address: Address) => {
    setSelectedAddressId(address.id);
    setEditingAddressId(address.id);
    setShipping(addressToShipping(address));
    setSetDefault(Boolean(address.is_default));
    setSaveAddress(true);
    setFieldErrors({});
  };

  const addNewAddress = () => {
    setSelectedAddressId(null);
    setEditingAddressId(null);
    setShipping({
      ...emptyShipping,
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    });
    setSaveAddress(true);
    setSetDefault(addresses.length === 0);
  };

  const editAddress = (address: Address) => {
    // Populate form with address data for editing
    setSelectedAddressId(null);   // deselect so form is shown
    setEditingAddressId(address.id);
    setShipping(addressToShipping(address));
    setSetDefault(Boolean(address.is_default));
    setSaveAddress(true);
    setFieldErrors({});
  };

  const deleteAddress = async (id: number) => {
    await api.deleteAddress(id);
    const next = addresses.filter((a) => a.id !== id);
    setAddresses(next);
    if (selectedAddressId === id) addNewAddress();
  };

  const confirmAddress = () => {
    const errors = validateShipping(shipping);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    saveCheckoutShipping({
      shipping,
      selectedAddressId: editingAddressId,
      saveAddress,
      setDefault,
      updateAddress: Boolean(editingAddressId) && saveAddress,
    });
    setLocation("/checkout/payment");
  };

  const field = (
    key: keyof ShippingForm,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={shipping[key]}
        onChange={(e) => update(key, e.target.value)}
        className="mt-1 border-border-light bg-white text-ink"
        aria-invalid={Boolean(fieldErrors[key])}
        {...props}
      />
      {fieldErrors[key] && <p className="mt-1 text-xs text-rose-700">{fieldErrors[key]}</p>}
    </div>
  );

  if (items.length === 0) return null;

  const isFormVisible = selectedAddressId === null;
  const selectedAddressData = addresses.find(a => a.id === selectedAddressId);

  return (
    <ShopLayout promo="Fast checkout and secure payments">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <p className="font-display text-xs tracking-[0.4em] text-gold-deep">- CHECKOUT</p>
          <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl md:text-5xl">Shipping Address</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            {!isFormVisible && selectedAddressData ? (
              <section className="rounded-lg border border-border-light bg-white p-5 md:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">DELIVER TO:</h2>
                    <div className="mt-4 flex items-center gap-2">
                      <p className="text-lg font-medium text-ink">{shipping.name}</p>
                      {selectedAddressData.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-700">
                          <Star className="h-3 w-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                      {formatAddress(selectedAddressData)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">{shipping.phone}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsAddressModalOpen(true)}
                    className="shrink-0 rounded border border-gold-deep px-4 py-1.5 text-sm font-medium text-gold-deep hover:bg-gold/10 transition-colors"
                  >
                    Change
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={confirmAddress}
                  className="mt-6 w-full rounded-full border-2 border-ink bg-ink py-6 tracking-[0.15em] text-white hover:bg-ink/90"
                >
                  CONTINUE TO PAYMENT
                </Button>
              </section>
            ) : (
              <section className="rounded-lg border border-border-light bg-white p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">DELIVERY DETAILS</h2>
                    <p className="mt-1 text-sm text-ink-muted">Add a new address for your delivery.</p>
                  </div>
                  {addresses.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setIsAddressModalOpen(true)}
                      className="text-sm font-medium text-gold-deep hover:text-ink"
                    >
                      Select Saved
                    </button>
                  )}
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    confirmAddress();
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {field("name", "Full Name", { required: true })}
                    {field("phone", "Mobile Number", { required: true, inputMode: "tel" })}
                    {field("email", "Email Address", { required: true, type: "email" })}
                    {field("alternatePhone", "Alternate Mobile Number", { inputMode: "tel" })}
                    {field("houseNumber", "House Number / Flat Number", { required: true })}
                    {field("street", "Street / Road Name", { required: true })}
                    {field("area", "Area / Locality", { required: true })}
                    {field("city", "City", { required: true })}
                    {field("state", "State", { required: true })}
                    {field("pincode", "PIN Code", { required: true, inputMode: "numeric", maxLength: 6 })}
                    {field("landmark", "Landmark")}
                    {field("companyName", "Company Name")}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border-light pt-4 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="h-4 w-4 accent-black"
                      />
                      Save this address
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={setDefault}
                        onChange={(e) => setSetDefault(e.target.checked)}
                        className="h-4 w-4 accent-black"
                      />
                      Set as default address
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full rounded-full border-2 border-ink bg-ink py-6 tracking-[0.15em] text-white hover:bg-ink/90"
                  >
                    CONTINUE TO PAYMENT
                  </Button>
                </form>
              </section>
            )}
          </div>

          <aside className="h-fit rounded-lg border border-border-light bg-white p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gold-deep" />
              <h2 className="font-display text-sm tracking-[0.3em] text-gold-deep">ORDER SUMMARY</h2>
            </div>
            <ul className="mt-5 space-y-4 text-sm text-ink">
              {items.map((i) => (
                <li key={i.product.slug} className="flex gap-3">
                  <img
                    src={i.product.image ?? "/images/bottle-mini.svg"}
                    alt={i.product.name}
                    className="h-16 w-12 shrink-0 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/bottle-mini.svg";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.product.name}</p>
                    <p className="text-xs text-ink-muted">Qty {i.quantity}</p>
                  </div>
                  <span className="font-display text-gold-deep">Rs {i.product.price * i.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-between border-t border-border-light pt-4">
              <span className="font-display tracking-widest text-ink-muted">TOTAL</span>
              <span className="font-display text-2xl text-gold-deep">Rs {total}</span>
            </div>
            <Link href="/cart" className="mt-5 block text-center text-sm tracking-widest text-ink-muted hover:text-gold-deep">
              BACK TO BAG
            </Link>
          </aside>
        </div>
      </div>
      
      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelect={selectAddress}
        onAddNew={addNewAddress}
        onEdit={editAddress}
        onDelete={deleteAddress}
      />
    </ShopLayout>
  );
}
