import { expect, test } from "@playwright/test";

// Three screens share one default administrator, with no account setup.
test("administrator coordinates an evacuation without signing in", async ({ browser, request }) => {
  await request.post("/api/emergency", { data: { action: "end" } });
  const dashboard = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext()).newPage();
  const responder = await (await browser.newContext()).newPage();

  await dashboard.goto("/");
  await expect(dashboard).toHaveURL(/\/dashboard$/);
  await expect(dashboard.getByText("Emergency administrator", { exact: true })).toBeVisible();
  await student.goto("/me");
  await student.getByLabel(/wheelchair/).check();
  await student.getByLabel(/Room you are in/).selectOption({ label: "UC-3-3" });
  await student.getByRole("button", { name: "Continue" }).click();
  await expect(student.getByText("No emergency right now.")).toBeVisible();
  await responder.goto("/responder");

  await dashboard.getByRole("button", { name: /Simulate fire alarm/ }).click();
  await expect(dashboard.getByText(/FIRE EMERGENCY ACTIVE/)).toBeVisible();
  await expect(student.getByRole("heading", { name: /Fire emergency/i })).toBeVisible();
  await student.getByRole("button", { name: "I need help" }).click();
  await expect(student.getByText(/Help requested/).first()).toBeVisible();
  await responder.getByRole("button", { name: /Accept/ }).click();
  await expect(student.getByText(/Emergency administrator has accepted/)).toBeVisible();
  await expect(dashboard.getByText("Accepted by Emergency administrator")).toBeVisible();
  await responder.getByRole("button", { name: /Mark Emergency administrator/ }).click();
  await expect(dashboard.getByText("Resolved — evacuated")).toBeVisible();
  await dashboard.getByRole("button", { name: /End emergency/ }).click();
  await expect(student.getByText("No emergency right now.")).toBeVisible();
});
