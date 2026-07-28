// ————— FREIGHT TRACKING: validation + deep links, no third-party APIs —————
// The identifiers ARE the tracking. An AWB validates itself (IATA check
// digit: serial mod 7), a container validates itself (ISO 6346 shape), and
// each maps to a carrier tracking page for one-tap status. API-fed milestone
// tracking (Terminal49-class) can bolt on later; nothing here precludes it.

// IATA AWB: 3-digit airline prefix + 8-digit number, last digit is a check
// digit = (first 7 of serial) mod 7. Catches typos at the door.
export function validateAwb(raw: string): { ok: boolean; formatted?: string; reason?: string } {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 11) return { ok: false, reason: "AWB is 11 digits (3-digit airline prefix + 8)" };
  const serial = digits.slice(3, 10);
  const check = Number(digits[10]);
  if (Number(serial) % 7 !== check) return { ok: false, reason: "check digit doesn't match — re-read the AWB" };
  return { ok: true, formatted: `${digits.slice(0, 3)}-${digits.slice(3)}` };
}

// ISO 6346: 4 letters (owner+category) + 7 digits. We validate shape, not
// the ISO check digit — carrier sites reject bad ones loudly enough.
export function validateContainer(raw: string): { ok: boolean; formatted?: string; reason?: string } {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{4}\d{7}$/.test(c)) return { ok: false, reason: "container looks like ABCD1234567 (4 letters + 7 digits)" };
  return { ok: true, formatted: c };
}

// Airline prefixes we actually ship on (India → US lanes). Fallback: a
// search link — honest, and it never 404s when a new airline appears.
const AWB_PREFIX_URLS: Record<string, (awb: string) => string> = {
  "098": () => `https://www.airindia.com/in/en/cargo.html`,                        // Air India (no deep-link param)
  "176": (a) => `https://www.skycargo.com/track-shipment/?awb=${a}`,               // Emirates
  "157": (a) => `https://www.qrcargo.com/s/track-your-shipment?documentNumber=${a.slice(4)}&documentPrefix=157`, // Qatar
  "235": (a) => `https://www.turkishcargo.com/en/online-services/shipment-tracking?awbNo=${a}`, // Turkish
  "020": (a) => `https://www.lufthansa-cargo.com/eservices/etracking?awb=${a}`,    // Lufthansa
  "160": (a) => `https://www.cathaycargo.com/en-us/manage/track-and-trace.html?awb=${a}`, // Cathay
  "006": (a) => `https://www.deltacargo.com/Cargo/home/trackShipment?awbNumber=${a}`, // Delta
  "016": (a) => `https://www.unitedcargo.com/en/us/track/awb.html?awb=${a}`,       // United
};

const OCEAN_CARRIER_URLS: Record<string, (id: string) => string> = {
  maersk: (id) => `https://www.maersk.com/tracking/${id}`,
  msc: (id) => `https://www.msc.com/en/track-a-shipment?trackingNumber=${id}`,
  "cma cgm": (id) => `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=${id}`,
  "hapag-lloyd": (id) => `https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html?container=${id}`,
  one: (id) => `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam=${id}`,
  evergreen: (id) => `https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do?TYPE=CONTAINER&CONTAINER_NO=${id}`,
};

export function trackingUrl(s: { mode: string; awb?: string | null; container_no?: string | null; bl_no?: string | null; courier_tracking?: string | null; carrier?: string | null }): string {
  if (s.mode === "air" && s.awb) {
    const prefix = s.awb.replace(/[^0-9]/g, "").slice(0, 3);
    const fn = AWB_PREFIX_URLS[prefix];
    return fn ? fn(s.awb) : `https://www.google.com/search?q=${encodeURIComponent(`air waybill ${s.awb} tracking`)}`;
  }
  if (s.mode === "sea" || s.mode === "ocean") {
    const id = s.container_no ?? s.bl_no ?? "";
    const key = (s.carrier ?? "").toLowerCase().trim();
    const hit = Object.keys(OCEAN_CARRIER_URLS).find(k => key.includes(k));
    return hit ? OCEAN_CARRIER_URLS[hit](id) : `https://www.google.com/search?q=${encodeURIComponent(`${s.carrier ?? "container"} ${id} tracking`)}`;
  }
  if ((s.mode === "domestic_parcel" || s.mode === "courier") && s.courier_tracking) {
    const t = s.courier_tracking.trim();
    const c = (s.carrier ?? "").toLowerCase();
    if (c.includes("dhl")) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`;
    if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${t}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${s.carrier ?? ""} ${t} tracking`)}`;
  }
  return "#";
}
