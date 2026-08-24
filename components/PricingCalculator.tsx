"use client";

import { useEffect, useState } from "react";

interface ServiceType {
  id: string;
  code: string;
  label: string;
}
interface Zone {
  id: string;
  code: string;
  name: string;
  needsConfirmation: boolean;
}
interface RateCardRef {
  id: string;
  name: string;
  state: string | null;
  isDefault: boolean;
}
interface OrgRef {
  id: string;
  companyName: string;
}

interface QuoteResult {
  found: boolean;
  reason?: string;
  serviceTypeLabel?: string;
  cbmBandLabel?: string;
  zoneName?: string;
  baseRate?: number;
  zoneAdjustment?: number;
  assemblyCharge?: number;
  otherExtras?: number;
  nettCharge?: number;
  fuelLevyPercentage?: number;
  fuelLevyAmount?: number;
  gstPercentage?: number;
  gstAmount?: number;
  totalPrice?: number;
  rateCardName?: string;
  rateCardEffectiveFrom?: string;
  rateCardTier?: string;
  ruleId?: string;
  driverPaymentPercent?: number;
  driverPayment?: number;
  companyMargin?: number;
  savingDollar?: number | null;
  savingPercent?: number | null;
}

const money = (n?: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);

export function PricingCalculator({ canOverrideFuelLevy }: { canOverrideFuelLevy: boolean }) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rateCards, setRateCards] = useState<RateCardRef[]>([]);
  const [organisations, setOrganisations] = useState<OrgRef[]>([]);

  const [form, setForm] = useState({
    organisationId: "",
    state: "QLD",
    originPostcode: "",
    destPostcode: "",
    zoneCode: "",
    serviceTypeCode: "",
    rateCardId: "",
    quantity: "",
    weight: "",
    cbm: "",
    deliveryDate: "",
    assemblyRequired: false,
    stairs: false,
    additionalLabourHours: "",
    otherSurcharge: "",
    fuelLevyOverridePercentage: "",
    currentCarrierPrice: "",
  });

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedNumber, setSavedNumber] = useState<string | null>(null);
  const [tab, setTab] = useState<"breakdown" | "margin" | "comparison">("breakdown");

  useEffect(() => {
    fetch("/api/pricing/reference")
      .then((r) => r.json())
      .then((json) => {
        setServiceTypes(json.serviceTypes ?? []);
        setZones(json.zones ?? []);
        setRateCards(json.rateCards ?? []);
        setOrganisations(json.organisations ?? []);
        const types: ServiceType[] = json.serviceTypes ?? [];
        const defaultType = types.find((t) => t.code === "STANDARD") ?? types[0];
        if (defaultType) update("serviceTypeCode", defaultType.code);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(save: boolean) {
    setLoading(true);
    setError(null);
    setSavedNumber(null);
    try {
      const res = await fetch("/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: form.organisationId || undefined,
          state: form.state,
          originPostcode: form.originPostcode || undefined,
          destPostcode: form.destPostcode,
          zoneCode: form.zoneCode || undefined,
          serviceTypeCode: form.serviceTypeCode,
          rateCardId: form.rateCardId || undefined,
          cbm: Number(form.cbm),
          weight: form.weight ? Number(form.weight) : undefined,
          quantity: form.quantity ? Number(form.quantity) : undefined,
          assemblyRequired: form.assemblyRequired,
          stairs: form.stairs,
          additionalLabourHours: form.additionalLabourHours ? Number(form.additionalLabourHours) : undefined,
          otherSurcharge: form.otherSurcharge ? Number(form.otherSurcharge) : undefined,
          fuelLevyOverridePercentage: form.fuelLevyOverridePercentage ? Number(form.fuelLevyOverridePercentage) : undefined,
          currentCarrierPrice: form.currentCarrierPrice ? Number(form.currentCarrierPrice) : undefined,
          save,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unable to price this delivery");
        setResult(null);
        return;
      }
      setResult(json.quote);
      if (json.saved) setSavedNumber(json.saved.quoteNumber);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="card space-y-3"
      >
        <h2 className="font-semibold">Delivery details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Client (optional)</label>
            <select className="field-input" value={form.organisationId} onChange={(e) => update("organisationId", e.target.value)}>
              <option value="">— No client-specific rate —</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">State</label>
            <input className="field-input" value={form.state} onChange={(e) => update("state", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="field-label">Pickup postcode</label>
            <input className="field-input" value={form.originPostcode} onChange={(e) => update("originPostcode", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Delivery postcode</label>
            <input required className="field-input" value={form.destPostcode} onChange={(e) => update("destPostcode", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Delivery zone</label>
            <select className="field-input" value={form.zoneCode} onChange={(e) => update("zoneCode", e.target.value)}>
              <option value="">— Not set —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.code}>
                  {z.code} — {z.name}
                  {z.needsConfirmation ? " (needs confirmation)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Rate card</label>
            <select className="field-input" value={form.rateCardId} onChange={(e) => update("rateCardId", e.target.value)}>
              <option value="">— Auto (state/client default) —</option>
              {rateCards.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  {rc.name}
                  {rc.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Service type</label>
            <select required className="field-input" value={form.serviceTypeCode} onChange={(e) => update("serviceTypeCode", e.target.value)}>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.code}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Quantity</label>
            <input type="number" min={0} className="field-input" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Weight (kg)</label>
            <input type="number" min={0} step="0.1" className="field-input" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
          </div>
          <div>
            <label className="field-label">CBM</label>
            <input required type="number" min={0} step="0.01" className="field-input" value={form.cbm} onChange={(e) => update("cbm", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Delivery date</label>
            <input type="date" className="field-input" value={form.deliveryDate} onChange={(e) => update("deliveryDate", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Other surcharge ($)</label>
            <input type="number" min={0} step="0.01" className="field-input" value={form.otherSurcharge} onChange={(e) => update("otherSurcharge", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Additional labour (hours)</label>
            <input type="number" min={0} step="0.5" className="field-input" value={form.additionalLabourHours} onChange={(e) => update("additionalLabourHours", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.assemblyRequired} onChange={(e) => update("assemblyRequired", e.target.checked)} />
            Assembly required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.stairs} onChange={(e) => update("stairs", e.target.checked)} />
            Stairs
          </label>
          <div>
            <label className="field-label">Current carrier price (for comparison)</label>
            <input type="number" min={0} step="0.01" className="field-input" value={form.currentCarrierPrice} onChange={(e) => update("currentCarrierPrice", e.target.value)} />
          </div>
          {canOverrideFuelLevy && (
            <div>
              <label className="field-label">Fuel levy override % (admin only)</label>
              <input type="number" min={0} step="0.01" className="field-input" value={form.fuelLevyOverridePercentage} onChange={(e) => update("fuelLevyOverridePercentage", e.target.value)} />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Calculating…" : "Calculate"}
          </button>
          {result?.found && (
            <button type="button" disabled={loading} className="btn-secondary" onClick={() => submit(true)}>
              Save quote
            </button>
          )}
        </div>
        {savedNumber && <p className="text-sm text-ok">Saved as {savedNumber}.</p>}
      </form>

      <div className="card space-y-4">
        {!result?.found && <p className="text-sm text-dim">Fill in the delivery details and press Calculate to see a real, rate-card-backed price.</p>}

        {result?.found && (
          <>
            <div className="flex gap-2 border-b border-line pb-2">
              {(["breakdown", "margin", "comparison"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${tab === t ? "bg-brand-500 text-white" : "bg-elevated text-dim"}`}
                >
                  {t === "breakdown" ? "Pricing Breakdown" : t === "margin" ? "Margin Calculator" : "Price Comparison"}
                </button>
              ))}
            </div>

            {tab === "breakdown" && (
              <div className="space-y-1.5 text-sm">
                <Row label="CBM" value={form.cbm} />
                <Row label="CBM Band" value={result.cbmBandLabel} />
                <Row label="Service" value={result.serviceTypeLabel} />
                <Row label="Zone" value={result.zoneName ?? "Not set"} />
                <Row label="Base Rate" value={money(result.baseRate)} />
                <Row label="Zone Adjustment" value={money(result.zoneAdjustment)} />
                <Row label="Assembly" value={money(result.assemblyCharge)} />
                <Row label="Other Extras" value={money(result.otherExtras)} />
                <Row label="Nett Delivery Charge" value={money(result.nettCharge)} bold />
                <Row label="Fuel Levy" value={`${result.fuelLevyPercentage}% = ${money(result.fuelLevyAmount)}`} />
                <Row label="Subtotal ex GST" value={money(round(result.nettCharge, result.fuelLevyAmount))} />
                <Row label="GST" value={`${result.gstPercentage}% = ${money(result.gstAmount)}`} />
                <Row label="Final Customer Price" value={money(result.totalPrice)} bold big />
                <div className="mt-3 space-y-0.5 border-t border-line pt-2 text-xs text-muted">
                  <p>Rate card used: {result.rateCardName} ({result.rateCardTier?.replaceAll("_", " ").toLowerCase()})</p>
                  <p>Rate effective from: {result.rateCardEffectiveFrom ? new Date(result.rateCardEffectiveFrom).toLocaleDateString("en-AU") : "—"}</p>
                  <p>Pricing rule ID: {result.ruleId}</p>
                </div>
              </div>
            )}

            {tab === "margin" && (
              <div className="space-y-1.5 text-sm">
                <Row label="Customer Nett Revenue" value={money(result.nettCharge)} bold />
                <Row label="Driver Percentage" value={`${result.driverPaymentPercent}%`} />
                <Row label="Driver Payment" value={money(result.driverPayment)} />
                <Row label="Company Gross Margin" value={`${round2Pct(result)}%`} />
                <Row label="Company Amount" value={money(result.companyMargin)} bold />
                <p className="pt-2 text-xs text-muted">GST is excluded from both driver payment and company margin.</p>
              </div>
            )}

            {tab === "comparison" && (
              <div className="space-y-1.5 text-sm">
                {form.currentCarrierPrice ? (
                  <>
                    <Row label="Current Carrier" value={`${money(Number(form.currentCarrierPrice))} ex GST`} />
                    <Row label="NexaMove" value={`${money(result.totalPrice)} ex GST`} bold />
                    <Row
                      label="Client Saving"
                      value={`${money(result.savingDollar)} / ${result.savingPercent != null ? `${result.savingPercent}%` : "—"}`}
                    />
                    <Row label="Driver Cost" value={money(result.driverPayment)} />
                    <Row label="NexaMove Gross Margin" value={money(result.companyMargin)} />
                  </>
                ) : (
                  <p className="text-dim">Enter a &quot;Current carrier price&quot; on the left to see a saving comparison.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, big }: { label: string; value?: string | number | null; bold?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dim">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${big ? "text-lg text-brand-600" : "text-ink"}`}>{value ?? "—"}</span>
    </div>
  );
}

function round(a?: number, b?: number) {
  if (a == null || b == null) return null;
  return Math.round((a + b + Number.EPSILON) * 100) / 100;
}

function round2Pct(result: QuoteResult) {
  if (result.driverPaymentPercent == null) return "—";
  return (100 - result.driverPaymentPercent).toFixed(0);
}
