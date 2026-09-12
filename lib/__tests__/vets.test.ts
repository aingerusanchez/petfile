import {
  EMPTY_VET,
  hasVet,
  mapsHref,
  readVet,
  telHref,
  vetColumn,
  vetLabel,
  writeVet,
  type Vet,
} from "../vets";

const filled: Vet = {
  clinic: "Clínica Veterinaria Los Burros",
  vet: "Espe",
  phone: "944 26 00 51",
  address: "Aguirre Lehendakaria 7, Bajo (48970 Basauri - Bizkaia)",
  hours: "L-V 10:00-13:30 y 17:00-20:00",
};

describe("readVet", () => {
  it("reads a card out of the column", () => {
    expect(readVet(filled)).toEqual(filled);
  });

  it("renders the half that exists when the other half does not", () => {
    // Everything arrives as `unknown` from `jsonb`, and a card written by an
    // older version of the app should not throw on the fields it never had.
    expect(readVet({ clinic: "Los Burros", phone: 944260051 })).toEqual({
      ...EMPTY_VET,
      clinic: "Los Burros",
    });
    expect(readVet(null)).toEqual(EMPTY_VET);
    expect(readVet(undefined)).toEqual(EMPTY_VET);
    expect(readVet("nada de esto")).toEqual(EMPTY_VET);
  });

  it("trims, so a space is not a value", () => {
    expect(readVet({ clinic: "  Los Burros  " }).clinic).toBe("Los Burros");
    expect(hasVet(readVet({ clinic: "   " }))).toBe(false);
  });
});

describe("writeVet", () => {
  it("drops the empties rather than storing blanks", () => {
    expect(writeVet({ ...EMPTY_VET, phone: "944 26 00 51" })).toEqual({
      phone: "944 26 00 51",
    });
  });

  it("writes nothing at all for a card cleared back to nothing", () => {
    // Null rather than an object full of "": `hasVet` has to be able to say
    // there is no card, and a row of blanks renders a row per blank.
    expect(writeVet(EMPTY_VET)).toBeNull();
    expect(writeVet({ ...EMPTY_VET, clinic: "  " })).toBeNull();
  });

  it("round-trips", () => {
    expect(readVet(writeVet(filled))).toEqual(filled);
  });
});

describe("telHref", () => {
  it("dials what was typed, spaces and all", () => {
    expect(telHref("944 26 00 51")).toBe("tel:944260051");
    expect(telHref("944-42-40-40")).toBe("tel:944424040");
  });

  it("invents no country code, and keeps one that was typed", () => {
    // Prefixing +34 to a number somebody wrote without one is the app
    // guessing which country the phone is in — wrong once and the call fails
    // at the moment it matters most.
    expect(telHref("944 26 00 51")).not.toContain("+");
    expect(telHref("+34 944 26 00 51")).toBe("tel:+34944260051");
  });

  it("has no answer for what is not a number", () => {
    expect(telHref("")).toBeNull();
    expect(telHref("   ")).toBeNull();
    expect(telHref("llamar a Espe")).toBeNull();
  });
});

describe("mapsHref", () => {
  it("hands the address to whichever maps app the phone uses", () => {
    const href = mapsHref("Sabino Arana 18, Bilbao");
    expect(href).toContain("google.com/maps/search/");
    expect(href).toContain(encodeURIComponent("Sabino Arana 18, Bilbao"));
  });

  it("has no answer for no address", () => {
    expect(mapsHref("")).toBeNull();
  });
});

describe("the two cards", () => {
  it("each knows its column and its name", () => {
    expect(vetColumn("primary")).toBe("vet_primary");
    expect(vetColumn("emergency")).toBe("vet_emergency");
    expect(vetLabel("primary")).toBe("Veterinario");
    expect(vetLabel("emergency")).toBe("Urgencias");
  });
});
