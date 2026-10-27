import {
  ACTIVE_PET_STORAGE_KEY,
  parseActivePetId,
  serializeActivePetId,
} from "../pet";

describe("parseActivePetId", () => {
  it("sin nada guardado no hay mascota activa", () => {
    expect(parseActivePetId(null)).toBeNull();
  });

  it("lee el id guardado", () => {
    expect(parseActivePetId(JSON.stringify({ id: "p1" }))).toBe("p1");
  });

  it("lo que no se entiende es nada", () => {
    expect(parseActivePetId("{not json")).toBeNull();
    expect(parseActivePetId(JSON.stringify({ id: 7 }))).toBeNull();
    expect(parseActivePetId(JSON.stringify({ id: "" }))).toBeNull();
  });
});

describe("serializeActivePetId", () => {
  it("lo que se escribe es lo que se lee", () => {
    expect(parseActivePetId(serializeActivePetId("p1"))).toBe("p1");
  });
});

describe("ACTIVE_PET_STORAGE_KEY", () => {
  it("es la clave versionada que el dispositivo ya conoce", () => {
    expect(ACTIVE_PET_STORAGE_KEY).toBe("petfile.pet.v1");
  });
});
