import { expect, test, type Browser, type Page } from "@playwright/test";

// Mirrors the 90-second demo: alarm → wheelchair user asks for help → responder accepts →
// evacuated. Three browser contexts stand in for the dashboard laptop and two phones.
// Roles come from the email lists in .env.test: team@ is the disaster recovery team, ben@ a responder.
const PASSWORD = "integration-test-password"; // same as tests/integration/helpers.ts: both suites share the test accounts

/** A signed-in page. The auth tables outlive a test run, so an existing account is signed in instead of created. */
async function signedIn(browser: Browser, email: string, name: string, profile: RegExp) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: /No account/ }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel(profile).check();
  await page.getByRole("button", { name: "Sign up" }).click();

  // Either we leave the sign-in page, or the form says the address is taken: then sign in instead.
  // (Scoped to the form: Next.js keeps its own empty role="alert" route announcer on every page.)
  const taken = page.locator("form").getByRole("alert");
  await expect.poll(async () => (await taken.isVisible()) || !page.url().includes("/sign-in")).toBe(true);
  if (await taken.isVisible()) {
    await page.getByRole("button", { name: /Have an account/ }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page).not.toHaveURL(/sign-in/);
  return page;
}

// Sign in once for the whole file: the auth endpoints are rate-limited in a production build, as they should be.
let dashboard: Page;
let student: Page;
let responder: Page;
test.beforeAll(async ({ browser }) => {
  dashboard = await signedIn(browser, "team@safeway.test", "Chief", /Normal/);
  student = await signedIn(browser, "aisha@safeway.test", "Aisha", /wheelchair/);
  responder = await signedIn(browser, "ben@safeway.test", "Ben", /Normal/);
});

test("wheelchair user gets help during a fire alarm", async () => {
  await expect(dashboard).toHaveURL(/\/dashboard/);
  await dashboard.request.post("/api/emergency", { data: { action: "end" } }); // clean slate

  await expect(student).toHaveURL(/\/me/);
  // Asked every visit: where are you now?
  await student.getByLabel(/Room you are in/).selectOption({ label: "UC-3-3" });
  await student.getByRole("button", { name: "Continue" }).click();
  await expect(student.getByText("No emergency right now.")).toBeVisible();

  await expect(responder).toHaveURL(/\/responder/);

  await dashboard.getByRole("button", { name: /Simulate fire alarm/ }).click();
  await expect(dashboard.getByText(/FIRE EMERGENCY ACTIVE/)).toBeVisible();

  await expect(student.getByRole("heading", { name: /Fire emergency/i })).toBeVisible();
  await student.getByRole("button", { name: "I need help" }).click();
  await expect(student.getByText(/Help requested/).first()).toBeVisible();

  await responder.getByRole("button", { name: /Accept/ }).click();
  await expect(student.getByText(/Ben has accepted/)).toBeVisible();
  await expect(dashboard.getByText("Accepted by Ben")).toBeVisible();

  await responder.getByRole("button", { name: /Mark Aisha/ }).click();
  await expect(dashboard.getByText("Resolved — evacuated")).toBeVisible();

  await dashboard.getByRole("button", { name: /End emergency/ }).click();
  await expect(student.getByText("No emergency right now.")).toBeVisible();
});

test("a student cannot open the team's screens or trigger the alarm", async () => {
  await student.goto("/dashboard");
  await expect(student).toHaveURL(/denied/);
  await expect(student.getByText("Your account is not allowed to open that screen.")).toBeVisible();
  const response = await student.request.post("/api/emergency", { data: { action: "activate", floorId: "uni-l3" } });
  expect(response.status()).toBe(403);
});
