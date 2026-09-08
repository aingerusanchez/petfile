/**
 * A curated list of dog breeds, in Spanish, for the breed combobox.
 *
 * **Why a list at all.** `pets.breed_primary` is free text with no enum or
 * foreign key, so nothing stops "Husky Siberiano", "husky", "Siberian Husky"
 * and "Huski" coexisting for the same animal. Breed is now one of the fields a
 * tutor uses to tell one pet from another, and the breed-percentile weight
 * band PRODUCT.md has parked needs a normalised value to exist at all.
 *
 * **Why free text is still allowed.** Mixed breeds, unknown provenance and
 * regional names all fall outside any list. The field suggests, it does not
 * constrain — this is a combobox, not a closed dropdown.
 *
 * This list is deliberately the common breeds in Spain rather than the full
 * FCI register (~350). Extend it here; nothing else needs to change.
 */
export const BREEDS_ES: readonly string[] = [
  "Affenpinscher",
  "Airedale Terrier",
  "Akita Inu",
  "Alaskan Malamute",
  "American Staffordshire Terrier",
  "Basset Hound",
  "Beagle",
  "Bichón Frisé",
  "Bichón Maltés",
  "Bobtail",
  "Border Collie",
  "Boston Terrier",
  "Bóxer",
  "Braco Alemán",
  "Bull Terrier",
  "Bulldog Francés",
  "Bulldog Inglés",
  "Bullmastiff",
  "Caniche",
  "Carlino",
  "Cavalier King Charles Spaniel",
  "Chihuahua",
  "Chow Chow",
  "Cocker Spaniel Inglés",
  "Collie",
  "Dálmata",
  "Doberman",
  "Dogo Alemán",
  "Dogo Argentino",
  "Dogo de Burdeos",
  "Fox Terrier",
  "Galgo Español",
  "Golden Retriever",
  "Husky Siberiano",
  "Jack Russell Terrier",
  "Labrador Retriever",
  "Lhasa Apso",
  "Mastín Español",
  "Mastín Napolitano",
  "Pastor Alemán",
  "Pastor Australiano",
  "Pastor Belga Malinois",
  "Pastor Catalán",
  "Pastor de Shetland",
  "Pequinés",
  "Perro de Agua Español",
  "Pinscher Miniatura",
  "Pitbull",
  "Podenco Andaluz",
  "Podenco Ibicenco",
  "Pomerania",
  "Presa Canario",
  "Rottweiler",
  "Sabueso Español",
  "Samoyedo",
  "San Bernardo",
  "Schnauzer",
  "Setter Inglés",
  "Setter Irlandés",
  "Shar Pei",
  "Shiba Inu",
  "Shih Tzu",
  "Staffordshire Bull Terrier",
  "Teckel",
  "Terranova",
  "Weimaraner",
  "West Highland White Terrier",
  "Whippet",
  "Yorkshire Terrier",
];

/**
 * Folds a string for comparison: lowercase, accents stripped.
 *
 * Without this, typing "pastor aleman" would not match "Pastor Alemán" — which
 * is exactly what a tutor types on a phone keyboard.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Breeds matching `query`, prefix matches first so a typed "bo" offers
 * "Bobtail" and "Border Collie" before "Bullmastiff".
 */
export function searchBreeds(query: string, limit = 6): string[] {
  const needle = foldForSearch(query);
  if (!needle) return [];

  const prefix: string[] = [];
  const contains: string[] = [];

  for (const breed of BREEDS_ES) {
    const folded = foldForSearch(breed);
    if (folded === needle) continue; // already typed exactly; nothing to suggest
    if (folded.startsWith(needle)) prefix.push(breed);
    else if (folded.includes(needle)) contains.push(breed);
  }

  return [...prefix, ...contains].slice(0, limit);
}

/** True when the value exactly matches a known breed, accents and case aside. */
export function isKnownBreed(value: string): boolean {
  const folded = foldForSearch(value);
  return BREEDS_ES.some((breed) => foldForSearch(breed) === folded);
}

/**
 * Words a tutor types into the breed field when the answer is "mixed".
 *
 * Not breeds, and deliberately absent from `BREEDS_ES`: "mestizo" answers the
 * breed question without naming a breed. An adopted dog often has no known
 * ancestry at all, so this is the honest answer rather than a gap — and it
 * already has a home in the record, the `is_mixed` flag.
 */
const MIXED_BREED_TERMS = [
  "mestizo",
  "mestiza",
  "mestizos",
  "mestizas",
  "mezcla",
  "mezclado",
  "mezclada",
  "cruce",
  "cruzado",
  "cruzada",
  "mixto",
  "mixta",
  "sin raza",
  "raza indefinida",
  "desconocida",
  "desconocido",
  "no lo sabemos",
  "no lo se",
  "ni idea",
  "chucho",
  "callejero",
  "callejera",
];

/**
 * True when the text is a way of saying "mixed" rather than a breed.
 *
 * **Why this exists.** The breed field takes free text, so nothing stopped a
 * tutor answering "Mestizo" — which reads perfectly ("Hulk — Mestizo") but
 * records a non-breed in `breed_primary` while `is_mixed` stays false. The
 * same fact then has two encodings, one of them wrong, and any later
 * breed-based calculation has to guess which. The display is legitimate; only
 * the storage was, so this recognises the intent and the flag carries it.
 */
export function meansMixedBreed(value: string | null): boolean {
  const folded = foldForSearch(value ?? "");
  if (!folded) return false;
  return MIXED_BREED_TERMS.includes(folded);
}

/**
 * True while the text is on its way to one of those terms.
 *
 * The offer in the field has to behave like the rest of the autocomplete,
 * which suggests from the third letter: waiting for the whole word means a
 * tutor typing "Mest" sees nothing at all and concludes the field has no
 * suggestions — measured on device, that is exactly what happened. Three
 * letters is also what keeps a single "c" from hijacking the field on its way
 * to "Caniche".
 *
 * Deliberately more generous than `meansMixedBreed`: this one only *offers*,
 * while that one silently rewrites what gets stored, so it stays exact.
 */
export function looksLikeMixedBreed(value: string | null): boolean {
  const folded = foldForSearch(value ?? "");
  if (folded.length < 3) return false;
  return MIXED_BREED_TERMS.some((term) => term.startsWith(folded));
}
