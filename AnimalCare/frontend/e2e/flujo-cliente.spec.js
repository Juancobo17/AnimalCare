// Flujo principal del dueño de mascota, de extremo a extremo en el navegador:
// registro con consentimiento, inicio de sesion, registro de una mascota,
// busqueda de veterinarios y cierre de sesion con rutas protegidas.
import { expect, test } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:4000/api";
const CLAVE = "Prueba123";
const correo = `e2e.${Date.now()}@test.com`;

test.describe.configure({ mode: "serial" });

test("el backend esta disponible", async ({ request }) => {
  const salud = await request.get(`${API}/health`);
  expect(salud.ok()).toBeTruthy();
});

test("registro de cliente con consentimiento (AN-6)", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(/Nombre completo/).fill("Cliente E2E");
  await page.getByLabel(/Correo electrónico/).fill(correo);
  await page.getByLabel(/^Contraseña/).fill(CLAVE);

  // Sin aceptar la politica no se crea la cuenta.
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("alert")).toContainText("política de privacidad");

  await page.getByRole("checkbox", { name: /política de privacidad/ }).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  // El aviso de exito es un toast (aviso emergente), no un cuadro role="alert".
  await expect(page.getByText("Tu cuenta fue creada")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});

test("credenciales incorrectas muestran el mensaje de AN-8", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico/).fill(correo);
  await page.getByLabel(/Contraseña/).fill("incorrecta9");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("Correo o contraseña incorrectos");
});

test("inicio de sesion, mascota, buscador y cierre de sesion", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico/).fill(correo);
  await page.getByLabel(/Contraseña/).fill(CLAVE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Confirma tu correo.")).toBeVisible();

  // Mascota.
  await page.goto("/mascotas");
  await page.getByLabel(/^Nombre/).fill("Luna");
  // La lista de especies es un selector propio (combobox), no un <select> nativo.
  await page.getByLabel(/Especie/).click();
  await page.getByRole("option", { name: "Gato" }).click();
  await page.getByLabel(/Nacimiento/).fill("2022-04-10");
  await page.getByRole("button", { name: "Registrar mascota" }).click();
  await expect(page.getByRole("heading", { name: "Luna" })).toBeVisible();

  // Buscador con proximo turno.
  await page.goto("/veterinarios");
  await expect(page.getByRole("heading", { name: "Veterinarios" })).toBeVisible();
  await page.getByLabel("Buscar").fill("zzz-no-existe");
  await expect(page.getByText(/No encontramos veterinarios/)).toBeVisible();

  // Cerrar sesion y proteccion de rutas (AN-32 escenario 3).
  // La cabecera puede tener un boton "Cerrar sesion" directo o un menu de la cuenta.
  const menuCuenta = page.getByRole("button", { name: /Cliente/ });
  if (await menuCuenta.count()) {
    await menuCuenta.click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  } else {
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
  }
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("recuperar contraseña responde sin revelar si el correo existe", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/recuperar$/);
  await page.getByLabel(/Correo electrónico/).fill("nadie@test.com");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("alert")).toContainText("Si el correo está registrado");
});
