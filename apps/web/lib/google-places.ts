// Google Maps / Places API utilities for overseas address autocomplete + validation

let scriptLoadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (window.google?.maps?.places) return Promise.resolve();

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Check again in case another instance already added the script tag
    const existing = document.querySelector('script[data-gmaps]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.gmaps = "1";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load Google Maps API"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface ParsedPlace {
  addr3: string; // street
  addr2: string; // city
  addr1: string; // state/province
  zip: string;
}

export function parsePlaceResult(
  place: google.maps.places.PlaceResult,
  countryCode: string
): ParsedPlace {
  const components = place.address_components ?? [];

  const get = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? "";
  const getShort = (type: string) =>
    components.find((c) => c.types.includes(type))?.short_name ?? "";

  const streetNumber = get("street_number");
  const route = get("route");
  const sublocality2 = get("sublocality_level_2");
  const sublocality1 = get("sublocality_level_1");
  const locality = get("locality");
  const adminArea1 = get("administrative_area_level_1");
  const adminArea1Short = getShort("administrative_area_level_1");
  const postalCode = get("postal_code");

  let addr3 = "";
  let addr2 = "";
  let addr1 = "";

  if (countryCode === "JP") {
    // Japan: chome/ban/go as street, ward/district as city, prefecture as state
    addr3 = [sublocality2, streetNumber].filter(Boolean).join("-") ||
      [route, streetNumber].filter(Boolean).join(" ") ||
      sublocality1;
    addr2 = sublocality1 || locality;
    addr1 = adminArea1;
  } else if (["US", "CA", "AU", "GB", "NZ"].includes(countryCode)) {
    // Western style: street number + route
    addr3 = [streetNumber, route].filter(Boolean).join(" ");
    addr2 = locality;
    addr1 = adminArea1Short || adminArea1;
  } else {
    // Generic fallback
    addr3 = [streetNumber, route].filter(Boolean).join(" ") || sublocality1;
    addr2 = sublocality1 || locality;
    addr1 = adminArea1;
  }

  // Fallback: use formatted_address first segment if addr3 is still empty
  if (!addr3 && place.formatted_address) {
    addr3 = place.formatted_address.split(",")[0].trim();
  }

  return { addr3, addr2, addr1, zip: postalCode };
}

export interface AddressValidationResult {
  suggestedAddr3: string;
  suggestedAddr2: string;
  suggestedAddr1: string;
  suggestedZip: string;
  formattedAddress: string;
  isSame: boolean;
}

// Google Address Validation REST API (requires Address Validation API enabled on the key)
export async function validateAddressWithGoogle(
  apiKey: string,
  addr: { addr3: string; addr2: string; addr1: string; zip: string; countryCode: string }
): Promise<AddressValidationResult | null> {
  try {
    const addressLines = [addr.addr3, addr.addr2, addr.addr1, addr.zip].filter(Boolean);
    if (!addressLines.length) return null;

    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            regionCode: addr.countryCode,
            addressLines,
          },
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.result;
    if (!result?.address) return null;

    const postalAddr = result.address.postalAddress ?? {};
    const lines: string[] = postalAddr.addressLines ?? [];
    const locality: string = postalAddr.locality ?? "";
    const adminArea: string = postalAddr.administrativeArea ?? "";
    const postalCode: string = postalAddr.postalCode ?? "";
    const formattedAddress: string = result.address.formattedAddress ?? "";

    const suggestedAddr3 = lines[0] ?? "";
    const suggestedAddr2 = locality;
    const suggestedAddr1 = adminArea;
    const suggestedZip = postalCode;

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const isSame =
      normalize(suggestedAddr3) === normalize(addr.addr3) &&
      normalize(suggestedAddr2) === normalize(addr.addr2) &&
      normalize(suggestedAddr1) === normalize(addr.addr1) &&
      normalize(suggestedZip) === normalize(addr.zip);

    return { suggestedAddr3, suggestedAddr2, suggestedAddr1, suggestedZip, formattedAddress, isSame };
  } catch {
    return null;
  }
}
