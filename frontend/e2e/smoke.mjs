// End-to-end smoke test: drives the installed Microsoft Edge (no browser download needed).
//   npm run e2e                     # against the Vite dev server
//   BASE=http://127.0.0.1:8000 npm run e2e   # against Django serving the build
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const SHOTS = process.env.SHOTS_DIR ?? "e2e/screenshots";
const USER = process.env.E2E_USER ?? "lina_haddad";
const PASSWORD = process.env.E2E_PASSWORD ?? "cookdemo123";
mkdirSync(SHOTS, { recursive: true });

const problems = [];
let expectErrors = false; // set while a step triggers errors on purpose
const results = [];

async function newPage(browser, { mobile = false, dark = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  page.on("console", (msg) => !expectErrors && msg.type() === "error" && problems.push(`console: ${msg.text()} @ ${page.url()}`));
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message} @ ${page.url()}`));
  page.on("response", (res) => {
    if (!expectErrors && res.status() >= 400 && !res.url().includes("/favicon")) problems.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return { context, page };
}

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push(`PASS  ${name} (${Date.now() - started} ms)`);
  } catch (err) {
    results.push(`FAIL  ${name}: ${err.message.split("\n")[0]}`);
  }
}

async function shot(page, name) {
  // SPA navigations don't reset "networkidle", so wait for loading skeletons to go away instead.
  await page.waitForFunction(() => !document.querySelector(".skeleton, [aria-busy='true']"), null, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username or email").fill(USER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE}/`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });

// ------------------------------------------------------------- desktop, light
{
  const { context, page } = await newPage(browser);
  await step("login page renders", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByRole("heading", { name: "Welcome back" }).waitFor();
    await shot(page, "01-login");
  });
  await step("wrong password shows an error", async () => {
    expectErrors = true;
    await page.getByLabel("Username or email").fill(USER);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("alert").filter({ hasText: "Wrong username or password" }).waitFor();
    await page.waitForTimeout(200);
    expectErrors = false;
  });
  await step("sign in through the form", async () => {
    await signIn(page);
    await page.getByRole("heading", { name: /Lina/ }).waitFor();
    await shot(page, "02-home");
  });

  const recipe = await (await page.request.get(`${BASE}/api/posts/?recipes=1&page_size=1`)).json();
  const recipeId = recipe.results[0].id;

  for (const [name, path, ready] of [
    ["03-explore-for-you", "/explore", "Explore"],
    ["04-explore-trending", "/explore/trending", "Explore"],
    ["05-cook", "/cook?i=rice,chicken,onion,garlic", "What can I cook?"],
    ["06-recipe", `/posts/${recipeId}`, "Ingredients"],
    ["07-profile", `/u/${USER}`, "Lina Haddad"],
    ["08-notifications", "/notifications", "Notifications"],
    ["09-messages", "/messages", "Messages"],
    ["10-saved", "/saved", "Saved"],
    ["11-settings", "/settings", "Settings"],
    ["12-search", "/search?q=pasta", "Search"],
    ["13-tag", "/tags/italian", "#italian"],
  ]) {
    await step(`page ${path}`, async () => {
      await page.goto(`${BASE}${path}`);
      await page.getByRole("heading", { name: ready }).first().waitFor({ timeout: 10_000 });
      await shot(page, name);
    });
  }

  await step("messages thread", async () => {
    await page.goto(`${BASE}/messages`);
    await page.locator("aside a[href^='/messages/']").first().click();
    await page.getByLabel("Write a message").waitFor();
    await shot(page, "14-thread");
  });

  await step("cook mode with timers", async () => {
    await page.goto(`${BASE}/posts/${recipeId}`);
    await page.getByRole("button", { name: "Start cook mode" }).click();
    await page.getByText(/Step 1 of/).waitFor();
    await page.keyboard.press("ArrowRight");
    await page.getByText(/Step 2 of/).waitFor();
    await shot(page, "15-cook-mode");
    await page.keyboard.press("Escape");
  });

  await step("like and unlike (optimistic)", async () => {
    await page.goto(`${BASE}/explore/latest`);
    const like = page.getByRole("button", { name: /^(Like|Unlike)$/ }).first();
    const before = await like.getAttribute("aria-pressed");
    await like.click();
    await page.waitForTimeout(400);
    if ((await like.getAttribute("aria-pressed")) === before) throw new Error("like state did not change");
    await like.click();
    await page.waitForTimeout(400);
    if ((await like.getAttribute("aria-pressed")) !== before) throw new Error("like state did not revert");
  });

  await step("command palette search", async () => {
    await page.goto(`${BASE}/`);
    await page.getByRole("heading", { name: /Lina/ }).waitFor();
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder(/Search recipes, people, tags/);
    await input.fill("pasta");
    await page.getByRole("option").nth(1).waitFor();
    await shot(page, "16-palette");
    await page.keyboard.press("Escape");
  });

  await step("create, find and delete a post", async () => {
    await page.goto(`${BASE}/`);
    await page.getByRole("heading", { name: /Lina/ }).waitFor();
    await page.keyboard.press("n");
    const text = `E2E test post ${Date.now()}`;
    await page.getByLabel("What's cooking?").fill(text);
    await shot(page, "17-composer");
    await page.getByRole("button", { name: "Post", exact: true }).click();
    const card = page.locator("article").filter({ hasText: text });
    await card.waitFor();
    await card.getByRole("button", { name: "Post options" }).click();
    await page.getByRole("menuitem", { name: "Delete post" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await card.waitFor({ state: "detached" });
  });

  await step("recipe composer", async () => {
    await page.goto(`${BASE}/`);
    await page.getByRole("button", { name: "Share a recipe" }).click();
    await page.getByLabel("Recipe name").fill("Test shakshuka");
    await page.getByLabel("Ingredients").fill("eggs");
    await page.keyboard.press("Enter");
    await page.getByLabel("Ingredients").fill("tomato");
    await page.keyboard.press("Enter");
    await shot(page, "18-recipe-composer");
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  await context.close();
}

// -------------------------------------------------------------- desktop, dark
{
  const { context, page } = await newPage(browser, { dark: true });
  await step("dark mode", async () => {
    await signIn(page);
    await shot(page, "20-dark-home");
    await page.goto(`${BASE}/cook?i=eggs,tomato,garlic`);
    await page.getByRole("heading", { name: "What can I cook?" }).waitFor();
    await shot(page, "21-dark-cook");
  });
  await context.close();
}

// -------------------------------------------------------------------- mobile
{
  const { context, page } = await newPage(browser, { mobile: true });
  await step("mobile", async () => {
    await page.goto(`${BASE}/login`);
    await shot(page, "30-mobile-login");
    await signIn(page);
    await shot(page, "31-mobile-home");
    await page.goto(`${BASE}/cook?i=rice,onion`);
    await page.getByRole("heading", { name: "What can I cook?" }).waitFor();
    await shot(page, "32-mobile-cook");
    await page.goto(`${BASE}/u/${USER}`);
    await page.getByRole("heading", { name: "Lina Haddad" }).waitFor();
    await shot(page, "33-mobile-profile");
    await page.goto(`${BASE}/messages`);
    await shot(page, "34-mobile-messages");
  });
  await context.close();
}

await browser.close();

console.log(results.join("\n"));
const unique = [...new Set(problems)];
console.log(`\n${unique.length} problem(s) seen by the browser`);
unique.slice(0, 40).forEach((p) => console.log("  " + p));
process.exitCode = results.some((r) => r.startsWith("FAIL")) || unique.length ? 1 : 0;
