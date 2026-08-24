"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ItemDraft {
  productDescription: string;
  sku: string;
  quantity: number;
  boxes: string;
  cbm: string;
  weight: string;
}

const emptyItem: ItemDraft = { productDescription: "", sku: "", quantity: 1, boxes: "", cbm: "", weight: "" };

export function CreateDeliveryForm({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    address: "",
    suburb: "",
    postcode: "",
    specialInstructions: "",
    assemblyRequired: false,
    packagingRemovalRequired: false,
  });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addItem() {
    setItems((it) => [...it, { ...emptyItem }]);
  }

  function updateItem(idx: number, key: keyof ItemDraft, value: string | number) {
    setItems((it) => it.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function removeItem(idx: number) {
    setItems((it) => it.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          customerName: form.customerName,
          customerPhone: form.customerPhone || undefined,
          address: form.address,
          suburb: form.suburb,
          postcode: form.postcode,
          specialInstructions: form.specialInstructions || undefined,
          assemblyRequired: form.assemblyRequired,
          packagingRemovalRequired: form.packagingRemovalRequired,
          items:
            items.length > 0
              ? items
                  .filter((i) => i.productDescription.trim())
                  .map((i) => ({
                    productDescription: i.productDescription,
                    sku: i.sku || undefined,
                    quantity: i.quantity,
                    boxes: i.boxes ? Number(i.boxes) : undefined,
                    cbm: i.cbm ? Number(i.cbm) : undefined,
                    weight: i.weight ? Number(i.weight) : undefined,
                  }))
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? "Failed to add delivery");
      setForm({
        customerName: "",
        customerPhone: "",
        address: "",
        suburb: "",
        postcode: "",
        specialInstructions: "",
        assemblyRequired: false,
        packagingRemovalRequired: false,
      });
      setItems([]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add delivery");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Add delivery stop
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">New delivery stop</h2>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Customer name</label>
          <input
            required
            className="field-input"
            value={form.customerName}
            onChange={(e) => update("customerName", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Customer phone (optional)</label>
          <input
            className="field-input"
            value={form.customerPhone}
            onChange={(e) => update("customerPhone", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Address</label>
          <input
            required
            className="field-input"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Suburb</label>
          <input
            required
            className="field-input"
            value={form.suburb}
            onChange={(e) => update("suburb", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Postcode</label>
          <input
            required
            maxLength={4}
            minLength={4}
            className="field-input"
            value={form.postcode}
            onChange={(e) => update("postcode", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Special instructions (optional)</label>
          <textarea
            className="field-input"
            rows={2}
            value={form.specialInstructions}
            onChange={(e) => update("specialInstructions", e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.assemblyRequired}
            onChange={(e) => update("assemblyRequired", e.target.checked)}
          />
          Assembly required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.packagingRemovalRequired}
            onChange={(e) => update("packagingRemovalRequired", e.target.checked)}
          />
          Packaging removal required
        </label>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Items (optional — leave empty for a single simple delivery)</p>
          <button type="button" className="text-sm text-brand-400 hover:underline" onClick={addItem}>
            + Add item
          </button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-6 gap-2 rounded-lg border border-line p-2">
            <input
              className="field-input col-span-2"
              placeholder="Product description"
              value={item.productDescription}
              onChange={(e) => updateItem(idx, "productDescription", e.target.value)}
            />
            <input className="field-input" placeholder="SKU" value={item.sku} onChange={(e) => updateItem(idx, "sku", e.target.value)} />
            <input
              type="number"
              min={1}
              className="field-input"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
            />
            <input className="field-input" placeholder="Boxes" value={item.boxes} onChange={(e) => updateItem(idx, "boxes", e.target.value)} />
            <button type="button" className="text-xs text-[#DC2626]" onClick={() => removeItem(idx)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Adding…" : "Add stop"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
