"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";

type Step = "navigate" | "arrive" | "photo" | "signature" | "services" | "damage" | "items" | "review" | "epod" | "failed";

interface DeliveryItemInfo {
  id: string;
  productDescription: string;
  quantity: number;
}

interface DeliveryData {
  id: string;
  customerName: string;
  customerPhone: string | null;
  address: string;
  suburb: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  specialInstructions: string | null;
  assemblyRequired: boolean;
  packagingRemovalRequired: boolean;
  status: string;
  alreadyCompleted: boolean;
  items: DeliveryItemInfo[];
}

interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
}

type PhotoCategory =
  | "PRODUCT_DELIVERED"
  | "PRODUCT_IN_FINAL_LOCATION"
  | "ASSEMBLY_COMPLETED"
  | "PACKAGING_REMOVED"
  | "CUSTOMER_PROPERTY_ACCESS"
  | "OTHER";

const PHOTO_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  PRODUCT_DELIVERED: "Product delivered",
  PRODUCT_IN_FINAL_LOCATION: "Product in final location",
  ASSEMBLY_COMPLETED: "Assembly completed",
  PACKAGING_REMOVED: "Packaging removed",
  CUSTOMER_PROPERTY_ACCESS: "Customer property / access",
  OTHER: "Other",
};

const FAILURE_REASONS = [
  ["CUSTOMER_NOT_HOME", "Customer not home"],
  ["CUSTOMER_REFUSED", "Customer refused"],
  ["CANNOT_ACCESS_PROPERTY", "Cannot access property"],
  ["INCORRECT_ADDRESS", "Incorrect address"],
  ["CUSTOMER_REQUESTED_RESCHEDULE", "Customer requested reschedule"],
  ["PRODUCT_DAMAGED", "Product damaged"],
  ["PRODUCT_MISSING", "Product missing"],
  ["UNSAFE_ACCESS", "Unsafe access"],
  ["VEHICLE_ACCESS_RESTRICTION", "Vehicle access restriction"],
  ["OUTSIDE_WINDOW", "Outside allowed delivery window"],
  ["OTHER", "Other"],
] as const;

const DAMAGE_STAGES = [
  ["BEFORE_LOADING", "Before loading"],
  ["DURING_LOADING", "During loading"],
  ["IN_VEHICLE", "In vehicle"],
  ["DURING_TRANSPORT", "During transport"],
  ["DURING_UNLOADING", "During unloading"],
  ["DURING_ASSEMBLY", "During assembly"],
  ["AT_CUSTOMER_PROPERTY", "At customer property"],
  ["CUSTOMER_REPORTED", "Customer reported"],
  ["UNKNOWN", "Unknown"],
] as const;

const DAMAGE_REASONS = [
  ["PRODUCT_ALREADY_DAMAGED", "Product already damaged"],
  ["WAREHOUSE_HANDLING", "Warehouse handling"],
  ["INCORRECT_LOADING", "Incorrect loading"],
  ["INSUFFICIENT_PROTECTION", "Insufficient protection"],
  ["PRODUCT_MOVEMENT", "Product movement in transit"],
  ["DRIVER_HANDLING", "Driver handling"],
  ["OFFSIDER_HANDLING", "Offsider handling"],
  ["CUSTOMER_ACCESS_ISSUE", "Customer access issue"],
  ["STAIRS", "Stairs"],
  ["LIFT_RESTRICTION", "Lift restriction"],
  ["ASSEMBLY_DAMAGE", "Assembly damage"],
  ["PACKAGING_FAILURE", "Packaging failure"],
  ["MANUFACTURING_DEFECT", "Manufacturing defect"],
  ["UNKNOWN", "Unknown"],
  ["OTHER", "Other"],
] as const;

const RECEIVER_RELATIONSHIPS = [
  ["CUSTOMER", "Customer"],
  ["FAMILY_MEMBER", "Family member"],
  ["STAFF", "Staff"],
  ["RECEPTION", "Reception"],
  ["OTHER", "Other"],
] as const;

const ITEM_STATUSES = [
  ["DELIVERED", "Delivered"],
  ["NOT_DELIVERED", "Not delivered"],
  ["DAMAGED", "Damaged"],
  ["MISSING", "Missing"],
  ["REFUSED", "Refused"],
] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function StopWorkflow({
  delivery,
  nextDeliveryId,
}: {
  delivery: DeliveryData;
  nextDeliveryId: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(delivery.alreadyCompleted ? "epod" : "navigate");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [gps, setGps] = useState<GpsPoint | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geofenceWarning, setGeofenceWarning] = useState<{ message: string } | null>(null);
  const [geofenceOverrideReason, setGeofenceOverrideReason] = useState("");

  const [photos, setPhotos] = useState<{ dataUrl: string; category: PhotoCategory }[]>([]);
  const [nextPhotoCategory, setNextPhotoCategory] = useState<PhotoCategory>("PRODUCT_DELIVERED");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverRelationship, setReceiverRelationship] = useState<(typeof RECEIVER_RELATIONSHIPS)[number][0] | "">("");
  const [contactless, setContactless] = useState(false);
  const [signatureException, setSignatureException] = useState("");

  const [assemblyCompleted, setAssemblyCompleted] = useState(false);
  const [packagingRemoved, setPackagingRemoved] = useState(false);

  const [hasDamage, setHasDamage] = useState<boolean | null>(null);
  const [damageStage, setDamageStage] = useState<(typeof DAMAGE_STAGES)[number][0] | "">("");
  const [damageReason, setDamageReason] = useState<(typeof DAMAGE_REASONS)[number][0] | "">("");
  const [damageDescription, setDamageDescription] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
  const damageFileInputRef = useRef<HTMLInputElement>(null);
  const [damageSubmitted, setDamageSubmitted] = useState(false);

  const [itemResults, setItemResults] = useState<Record<string, (typeof ITEM_STATUSES)[number][0]>>(
    Object.fromEntries(delivery.items.map((i) => [i.id, "DELIVERED"]))
  );

  const [podResult, setPodResult] = useState<{ capturedAt: string; finalStatus: string } | null>(null);

  const [showFailedForm, setShowFailedForm] = useState(false);
  const [failReason, setFailReason] = useState<(typeof FAILURE_REASONS)[number][0] | "">("");
  const [failNotes, setFailNotes] = useState("");
  const [failPhoto, setFailPhoto] = useState<string | null>(null);
  const failFileInputRef = useRef<HTMLInputElement>(null);
  const [failSubmitting, setFailSubmitting] = useState(false);

  const mapsUrl =
    delivery.lat && delivery.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${delivery.lat},${delivery.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${delivery.address}, ${delivery.suburb} QLD ${delivery.postcode}`
        )}`;

  function goTo(s: Step) {
    setError(null);
    setStep(s);
  }

  async function captureGps(): Promise<GpsPoint> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("GPS is not available on this device/browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => reject(new Error(`Could not get GPS location: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  async function handleOnMyWay() {
    setError(null);
    setGpsLoading(true);
    try {
      const point = await captureGps();
      setGps(point);
      const res = await fetch(`/api/deliveries/${delivery.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EN_ROUTE", lat: point.lat, lng: point.lng }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to record en-route status");
      goTo("arrive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start route");
    } finally {
      setGpsLoading(false);
    }
  }

  async function handleConfirmArrival(overrideReason?: string) {
    setError(null);
    setGpsLoading(true);
    try {
      const point = gps ?? (await captureGps());
      setGps(point);
      const res = await fetch(`/api/deliveries/${delivery.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ARRIVED",
          lat: point.lat,
          lng: point.lng,
          geofenceOverrideReason: overrideReason,
        }),
      });
      const json = await res.json();
      if (res.status === 422 && json.error === "geofence_warning") {
        setGeofenceWarning({ message: json.message });
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to record arrival");
      setGeofenceWarning(null);
      goTo("photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture GPS location");
    } finally {
      setGpsLoading(false);
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPhotos((p) => [...p, { dataUrl, category: nextPhotoCategory }]);
    e.target.value = "";
  }

  async function handleDamagePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setDamagePhotos((p) => [...p, dataUrl]);
    e.target.value = "";
  }

  async function handleFailedPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFailPhoto(await readFileAsDataUrl(file));
    e.target.value = "";
  }

  async function submitDamageReport() {
    if (!damageStage || !damageReason || !damageDescription.trim()) {
      setError("Fill in the damage stage, reason, and description.");
      return;
    }
    if (damagePhotos.length === 0) {
      setError("At least one damage photo is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}/damage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discoveredStage: damageStage,
          reason: damageReason,
          description: damageDescription,
          gpsLat: gps?.lat,
          gpsLng: gps?.lng,
          photos: damagePhotos,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit damage report");
      setDamageSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit damage report");
    } finally {
      setSubmitting(false);
    }
  }

  function nextStepAfterServices() {
    goTo("damage");
  }

  function nextStepAfterDamage() {
    if (delivery.items.length > 0) goTo("items");
    else goTo("review");
  }

  async function handleCompleteDelivery(overrideReason?: string) {
    if (photos.length === 0 || (!gps) || (!contactless && !signatureDataUrl && !signatureException)) {
      setError("Missing required steps — please go back and complete them.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}/pod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: photos.map((p) => ({ dataUrl: p.dataUrl, category: p.category })),
          signatureDataUrl: signatureDataUrl ?? undefined,
          receiverName: receiverName || undefined,
          receiverRelationship: receiverRelationship || undefined,
          signatureExceptionReason: signatureException || undefined,
          contactless,
          assemblyCompleted,
          packagingRemoved,
          gpsLat: gps.lat,
          gpsLng: gps.lng,
          gpsAccuracyM: gps.accuracy,
          geofenceOverrideReason: overrideReason,
          itemResults:
            delivery.items.length > 0
              ? delivery.items.map((i) => ({ itemId: i.id, status: itemResults[i.id] }))
              : undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 422 && json.error === "geofence_warning") {
        setGeofenceWarning({ message: json.message });
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to complete delivery");
      setGeofenceWarning(null);
      setPodResult({ capturedAt: json.pod.capturedAt, finalStatus: json.finalStatus });
      goTo("epod");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete delivery");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFailedDelivery() {
    if (!failReason) {
      setError("Select a reason.");
      return;
    }
    const photoRequired = ["CANNOT_ACCESS_PROPERTY", "UNSAFE_ACCESS", "INCORRECT_ADDRESS", "PRODUCT_DAMAGED"].includes(
      failReason
    );
    if (photoRequired && !failPhoto) {
      setError("A photo is required for this reason.");
      return;
    }
    setFailSubmitting(true);
    setError(null);
    try {
      const point = gps ?? (await captureGps());
      const res = await fetch(`/api/deliveries/${delivery.id}/fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: failReason,
          notes: failNotes || undefined,
          gpsLat: point.lat,
          gpsLng: point.lng,
          photoDataUrl: failPhoto ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to report failed delivery");
      goTo("failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report failed delivery");
    } finally {
      setFailSubmitting(false);
    }
  }

  const requiredServicesStep = delivery.assemblyRequired || delivery.packagingRemovalRequired;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-10 border-b border-line bg-card px-4 py-3">
        <button onClick={() => router.push("/driver")} className="text-sm font-medium text-dim">
          ← Back to route
        </button>
        <h1 className="mt-1 text-lg font-bold">{delivery.customerName}</h1>
        <p className="text-sm text-dim">
          {delivery.address}, {delivery.suburb} QLD {delivery.postcode}
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {error && (
          <div role="alert" className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        {showFailedForm && step !== "failed" ? (
          <div className="card space-y-3">
            <h2 className="font-semibold text-[#DC2626]">❌ Delivery failed</h2>
            <div>
              <label className="field-label">Reason</label>
              <select
                className="field-input"
                value={failReason}
                onChange={(e) => setFailReason(e.target.value as typeof failReason)}
              >
                <option value="">Select a reason</option>
                {FAILURE_REASONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea className="field-input" rows={2} value={failNotes} onChange={(e) => setFailNotes(e.target.value)} />
            </div>
            <input
              ref={failFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFailedPhotoSelected}
            />
            {failPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={failPhoto} alt="Failed delivery evidence" className="w-full rounded-lg" />
            )}
            <button type="button" className="btn-secondary w-full" onClick={() => failFileInputRef.current?.click()}>
              {failPhoto ? "Retake photo" : "Add photo"}
            </button>
            <button className="btn-primary w-full !bg-red-600 hover:!bg-red-700" disabled={failSubmitting} onClick={submitFailedDelivery}>
              {failSubmitting ? "Submitting…" : "Confirm delivery failed"}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => setShowFailedForm(false)}>
              Cancel — go back to delivery
            </button>
          </div>
        ) : (
          <>
            {step === "navigate" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">1. Navigate to stop</h2>
                <p className="text-sm text-dim">{delivery.specialInstructions || "No special delivery notes."}</p>
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-primary w-full">
                  🗺 Open turn-by-turn navigation
                </a>
                <button className="btn-secondary w-full" disabled={gpsLoading} onClick={handleOnMyWay}>
                  {gpsLoading ? "Starting…" : "I’m on my way — continue"}
                </button>
              </div>
            )}

            {step === "arrive" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">2. 📍 I&apos;ve arrived</h2>
                <p className="text-sm text-dim">
                  Capture your current GPS position to confirm you&apos;re at the delivery address.
                </p>
                {gps && (
                  <p className="text-xs text-dim">
                    Captured: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (±{Math.round(gps.accuracy)}m)
                  </p>
                )}
                {geofenceWarning && (
                  <div className="space-y-2 rounded-lg bg-[#FFF7ED] p-3">
                    <p className="text-sm font-medium text-amber-800">⚠️ {geofenceWarning.message}</p>
                    <input
                      className="field-input"
                      placeholder="Reason for override (required to continue)"
                      value={geofenceOverrideReason}
                      onChange={(e) => setGeofenceOverrideReason(e.target.value)}
                    />
                    <button
                      className="btn-secondary w-full"
                      disabled={!geofenceOverrideReason.trim() || gpsLoading}
                      onClick={() => handleConfirmArrival(geofenceOverrideReason)}
                    >
                      Continue anyway
                    </button>
                  </div>
                )}
                <button className="btn-primary w-full" disabled={gpsLoading} onClick={() => handleConfirmArrival()}>
                  {gpsLoading ? "Capturing GPS…" : "I've arrived — capture GPS"}
                </button>
                <button type="button" className="text-center text-sm text-[#DC2626] underline w-full" onClick={() => setShowFailedForm(true)}>
                  Report a delivery problem instead
                </button>
              </div>
            )}

            {step === "photo" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">3. 📷 Delivery photos</h2>
                <p className="text-xs text-dim">
                  Take at least one photo. For furniture, a clear shot of the product in its final location is strongly
                  recommended.
                </p>
                <div>
                  <label className="field-label">Next photo category</label>
                  <select
                    className="field-input"
                    value={nextPhotoCategory}
                    onChange={(e) => setNextPhotoCategory(e.target.value as PhotoCategory)}
                  >
                    {Object.entries(PHOTO_CATEGORY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={PHOTO_CATEGORY_LABEL[p.category]} className="w-full rounded-lg" />
                      <p className="text-xs text-dim">{PHOTO_CATEGORY_LABEL[p.category]}</p>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary w-full" onClick={() => fileInputRef.current?.click()}>
                  {photos.length === 0 ? "Take photo" : "Add another photo"}
                </button>
                <button className="btn-primary w-full" disabled={photos.length === 0} onClick={() => goTo("signature")}>
                  Continue
                </button>
                {photos.length === 0 && <p className="text-center text-xs text-muted">At least one photo is required</p>}
              </div>
            )}

            {step === "signature" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">4. ✍️ Receiver + signature</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={contactless} onChange={(e) => setContactless(e.target.checked)} />
                  Contactless delivery (customer not present)
                </label>
                {!contactless && (
                  <>
                    <div>
                      <label className="field-label">Who received the delivery?</label>
                      <select
                        className="field-input"
                        value={receiverRelationship}
                        onChange={(e) => setReceiverRelationship(e.target.value as typeof receiverRelationship)}
                      >
                        <option value="">Select…</option>
                        {RECEIVER_RELATIONSHIPS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Receiver name</label>
                      <input
                        className="field-input"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Name of person who received the delivery"
                      />
                    </div>
                    <SignaturePad onChange={setSignatureDataUrl} />
                    <div>
                      <label className="field-label">Customer unavailable to sign? (optional)</label>
                      <input
                        className="field-input"
                        value={signatureException}
                        onChange={(e) => setSignatureException(e.target.value)}
                        placeholder="Reason, if no signature was captured"
                      />
                    </div>
                  </>
                )}
                <button
                  className="btn-primary w-full"
                  disabled={!contactless && !signatureDataUrl && !signatureException.trim()}
                  onClick={() => (requiredServicesStep ? goTo("services") : nextStepAfterServices())}
                >
                  Continue
                </button>
              </div>
            )}

            {step === "services" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">5. Services</h2>
                {delivery.assemblyRequired && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assemblyCompleted} onChange={(e) => setAssemblyCompleted(e.target.checked)} />
                    Assembly completed
                  </label>
                )}
                {delivery.packagingRemovalRequired && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={packagingRemoved} onChange={(e) => setPackagingRemoved(e.target.checked)} />
                    Packaging removed
                  </label>
                )}
                <button className="btn-primary w-full" onClick={nextStepAfterServices}>
                  Continue
                </button>
              </div>
            )}

            {step === "damage" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">6. ⚠️ Damage check</h2>
                {!damageSubmitted ? (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={hasDamage === false ? "btn-primary flex-1" : "btn-secondary flex-1"}
                        onClick={() => setHasDamage(false)}
                      >
                        No damage
                      </button>
                      <button
                        type="button"
                        className={hasDamage === true ? "btn-primary flex-1" : "btn-secondary flex-1"}
                        onClick={() => setHasDamage(true)}
                      >
                        Damage present
                      </button>
                    </div>
                    {hasDamage && (
                      <div className="space-y-3">
                        <div>
                          <label className="field-label">When was damage discovered?</label>
                          <select className="field-input" value={damageStage} onChange={(e) => setDamageStage(e.target.value as typeof damageStage)}>
                            <option value="">Select…</option>
                            {DAMAGE_STAGES.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Likely reason</label>
                          <select className="field-input" value={damageReason} onChange={(e) => setDamageReason(e.target.value as typeof damageReason)}>
                            <option value="">Select…</option>
                            {DAMAGE_REASONS.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Description</label>
                          <textarea
                            className="field-input"
                            rows={3}
                            value={damageDescription}
                            onChange={(e) => setDamageDescription(e.target.value)}
                          />
                        </div>
                        <input
                          ref={damageFileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleDamagePhotoSelected}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {damagePhotos.map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p} alt="Damage evidence" className="w-full rounded-lg" />
                          ))}
                        </div>
                        <button type="button" className="btn-secondary w-full" onClick={() => damageFileInputRef.current?.click()}>
                          {damagePhotos.length === 0 ? "Add damage photo" : "Add another photo"}
                        </button>
                        <p className="text-xs text-muted">
                          Responsibility is not assigned here — Operations will review and determine responsibility.
                        </p>
                        <button className="btn-primary w-full" disabled={submitting} onClick={submitDamageReport}>
                          {submitting ? "Submitting…" : "Submit damage report"}
                        </button>
                      </div>
                    )}
                    {hasDamage === false && (
                      <button className="btn-primary w-full" onClick={nextStepAfterDamage}>
                        Continue
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#16A34A]">Damage report submitted.</p>
                    <button className="btn-primary w-full" onClick={nextStepAfterDamage}>
                      Continue
                    </button>
                  </>
                )}
              </div>
            )}

            {step === "items" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">7. Item-by-item result</h2>
                <p className="text-xs text-dim">Mark the outcome for each item on this delivery.</p>
                {delivery.items.map((item) => (
                  <div key={item.id} className="space-y-1 border-b border-line pb-2 last:border-0">
                    <p className="text-sm font-medium">
                      {item.productDescription} × {item.quantity}
                    </p>
                    <select
                      className="field-input"
                      value={itemResults[item.id]}
                      onChange={(e) => setItemResults((r) => ({ ...r, [item.id]: e.target.value as (typeof ITEM_STATUSES)[number][0] }))}
                    >
                      {ITEM_STATUSES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button className="btn-primary w-full" onClick={() => goTo("review")}>
                  Continue
                </button>
              </div>
            )}

            {step === "review" && (
              <div className="card space-y-3">
                <h2 className="font-semibold">Delivery checklist</h2>
                <ul className="space-y-1 text-sm">
                  <li>✅ Product delivered to correct address</li>
                  <li>{photos.length > 0 ? "✅" : "❌"} Required photo uploaded ({photos.length})</li>
                  <li>
                    {contactless || signatureDataUrl || signatureException ? "✅" : "❌"} Signature captured or exception
                    recorded
                  </li>
                  {delivery.assemblyRequired && <li>{assemblyCompleted ? "✅" : "⚠️"} Assembly completed</li>}
                  {delivery.packagingRemovalRequired && <li>{packagingRemoved ? "✅" : "⚠️"} Packaging removed</li>}
                  <li>{hasDamage === null ? "⚠️ Damage check skipped" : hasDamage ? "⚠️ Damage reported" : "✅ No damage identified"}</li>
                </ul>
                {geofenceWarning && (
                  <div className="space-y-2 rounded-lg bg-[#FFF7ED] p-3">
                    <p className="text-sm font-medium text-amber-800">⚠️ {geofenceWarning.message}</p>
                    <input
                      className="field-input"
                      placeholder="Reason for override (required to continue)"
                      value={geofenceOverrideReason}
                      onChange={(e) => setGeofenceOverrideReason(e.target.value)}
                    />
                    <button
                      className="btn-primary w-full"
                      disabled={!geofenceOverrideReason.trim() || submitting}
                      onClick={() => handleCompleteDelivery(geofenceOverrideReason)}
                    >
                      Continue anyway
                    </button>
                  </div>
                )}
                <button className="btn-primary w-full" disabled={submitting} onClick={() => handleCompleteDelivery()}>
                  {submitting ? "Submitting…" : "✅ Complete delivery"}
                </button>
              </div>
            )}

            {step === "epod" && (
              <div className="card space-y-3 text-center">
                <h2 className="font-semibold text-[#16A34A]">
                  {podResult?.finalStatus === "PARTIALLY_DELIVERED" ? "Delivery partially completed" : "Delivery complete"}
                </h2>
                <p className="text-sm text-dim">
                  Electronic proof of delivery has been saved with a timestamp, GPS location, photos and signature.
                </p>
                {podResult && (
                  <p className="text-xs text-muted">Captured {new Date(podResult.capturedAt).toLocaleString("en-AU")}</p>
                )}
                {nextDeliveryId ? (
                  <button className="btn-primary w-full" onClick={() => router.push(`/driver/stop/${nextDeliveryId}`)}>
                    Next stop
                  </button>
                ) : (
                  <button className="btn-primary w-full" onClick={() => router.push("/driver")}>
                    Back to route — no more stops
                  </button>
                )}
              </div>
            )}

            {step === "failed" && (
              <div className="card space-y-3 text-center">
                <h2 className="font-semibold text-[#DC2626]">❌ Delivery marked failed</h2>
                <p className="text-sm text-dim">Operations and Customer Service have been notified.</p>
                {nextDeliveryId ? (
                  <button className="btn-primary w-full" onClick={() => router.push(`/driver/stop/${nextDeliveryId}`)}>
                    Next stop
                  </button>
                ) : (
                  <button className="btn-primary w-full" onClick={() => router.push("/driver")}>
                    Back to route
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
