import { REQUEST_TIMEOUT_MS } from "../failures";
import {
  ACTIVE_PET_READ_TIMEOUT_MS,
  ACTIVE_PET_STORAGE_KEY,
  parseActivePetId,
  resolveInitial,
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

/**
 * La resolución de la primera lectura, que es donde se juntan los tres
 * caminos del proveedor: el disco contestó, el disco no se pudo leer y el
 * disco tardó demasiado. Los dos últimos llegan aquí como `null`, así que
 * probar `null` los prueba a los dos — y el cuarto caso, el de la elección
 * hecha antes de que la lectura aterrice, es el que no tenía prueba ninguna
 * y es el único que puede mover la pantalla debajo del tutor.
 */
describe("resolveInitial", () => {
  it("lo que el disco guardó es lo que se aplica", () => {
    expect(resolveInitial(serializeActivePetId("p1"), false)).toEqual({
      apply: true,
      id: "p1",
    });
  });

  it("no haber podido leer es no tener elección guardada", () => {
    expect(resolveInitial(null, false)).toEqual({ apply: true, id: null });
    expect(resolveInitial("{not json", false)).toEqual({
      apply: true,
      id: null,
    });
  });

  it("una elección ya hecha no la pisa la lectura que llega después", () => {
    expect(resolveInitial(serializeActivePetId("p1"), true)).toEqual({
      apply: false,
      id: null,
    });
    // Y tampoco la pisa un fallo: la mascota elegida se queda.
    expect(resolveInitial(null, true)).toEqual({ apply: false, id: null });
  });
});

describe("ACTIVE_PET_READ_TIMEOUT_MS", () => {
  // No es el número lo que importa, sino que exista y sea más corto que el
  // de la red: cinco pantallas esperan a que baje la bandera, así que una
  // lectura sin plazo es la app colgada, y doce segundos de spinner para
  // ahorrarse una caída a la ficha más antigua es el canje al revés.
  it("es más corto que el plazo de la red", () => {
    expect(ACTIVE_PET_READ_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ACTIVE_PET_READ_TIMEOUT_MS).toBeLessThan(REQUEST_TIMEOUT_MS);
  });
});
