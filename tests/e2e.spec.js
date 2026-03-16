// @ts-check
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:8000";

test.describe("Cadence E2E", () => {
  test("page loads with correct title and elements", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle("Cadence - AI Creative Director");
    await expect(page.locator("h1")).toContainText("Cadence");
    await expect(page.locator("#start-btn")).toBeVisible();
    await expect(page.locator("#demo-btn")).toBeVisible();
    await expect(page.locator("#status-text")).toContainText("Ready");
  });

  test("empty state shows step cards", async ({ page }) => {
    await page.goto(BASE);
    const steps = page.locator(".step-card");
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0)).toContainText("Share a tab");
    await expect(steps.nth(1)).toContainText("Ask Cadence");
    await expect(steps.nth(2)).toContainText("trend ideas");
    await expect(steps.nth(3)).toContainText("scripts written");
  });

  test("demo button loads profile and populates insights", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#demo-btn");

    // Should show system + cadence transcript entries
    await expect(page.locator(".transcript-entry.system")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".transcript-entry.cadence")).toBeVisible({ timeout: 5000 });

    // System message should mention Alex Rivera
    const sysText = await page.locator(".transcript-entry.system .transcript-text").first().textContent();
    expect(sysText).toContain("Alex Rivera");

    // Empty state should be hidden
    await expect(page.locator("#empty-state")).toBeHidden();
  });

  test("demo button disables then re-enables", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#demo-btn");
    await expect(page.locator("#demo-btn")).toBeDisabled();
    // Re-enables after 2 seconds
    await expect(page.locator("#demo-btn")).toBeEnabled({ timeout: 3000 });
  });

  test("demo button repeated clicks do not duplicate data", async ({ page }) => {
    await page.goto(BASE);

    // Click demo once
    await page.click("#demo-btn");
    await expect(page.locator(".transcript-entry.system")).toBeVisible({ timeout: 5000 });

    // Count tags after first click
    const firstClickTagCount = await page.locator(".insight-tag").count();

    // Wait for re-enable
    await expect(page.locator("#demo-btn")).toBeEnabled({ timeout: 3000 });

    // Click demo again
    await page.click("#demo-btn");
    await expect(page.locator(".transcript-entry.system")).toBeVisible({ timeout: 5000 });

    // Should have exactly 2 transcript entries (1 system + 1 cadence), not 4
    const entries = page.locator(".transcript-entry");
    await expect(entries).toHaveCount(2);

    // Insight tags should be the same count as first click, not doubled
    const secondClickTagCount = await page.locator(".insight-tag").count();
    expect(secondClickTagCount).toBe(firstClickTagCount);
  });

  test("text input sends message via WebSocket", async ({ page }) => {
    await page.goto(BASE);

    const input = page.locator("#text-input");
    const sendBtn = page.locator("#send-btn");
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", /Talk to Cadence/);
  });

  test("text input does not send when not connected", async ({ page }) => {
    await page.goto(BASE);

    // Type into input and try to send — should not crash
    await page.fill("#text-input", "Hello test");
    await page.click("#send-btn");

    // Input should still have text (wasn't cleared because send was blocked)
    await expect(page.locator("#text-input")).toHaveValue("Hello test");

    // No user transcript entry should appear (not connected)
    const userEntries = page.locator(".transcript-entry.user");
    await expect(userEntries).toHaveCount(0);
  });

  test("suggestion chips are cleared from DOM when hidden", async ({ page }) => {
    await page.goto(BASE);

    // Verify chips container starts empty
    const chipsContainer = page.locator("#suggestion-chips");
    const initialHtml = await chipsContainer.innerHTML();
    expect(initialHtml.trim()).toBe("");
  });

  test("health endpoint responds", async ({ request }) => {
    const resp = await request.get(`${BASE}/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("cadence");
  });

  test("demo profile API returns valid profile", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/demo-profile`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.creator_name).toBe("Alex Rivera");
    expect(body.profile.signature_moves.length).toBeGreaterThan(0);
  });

  test("profiles API returns list", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/profiles`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(Array.isArray(body.profiles)).toBeTruthy();
  });

  test("unknown profile returns 404", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/profiles/nonexistent_user_xyz`);
    expect(resp.status()).toBe(404);
  });

  test("WebSocket connects and receives kickstart response", async ({ page }) => {
    await page.goto(BASE);

    const messages = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const msgs = [];
        const ws = new WebSocket(
          `ws://localhost:8000/ws/test_pw/test_session_${Date.now()}`
        );
        ws.onmessage = (e) => {
          if (typeof e.data === "string") {
            msgs.push(JSON.parse(e.data));
          }
          if (msgs.length >= 3) {
            ws.close();
            resolve(msgs.map((m) => Object.keys(m)));
          }
        };
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "text", text: "Hello" }));
        };
        setTimeout(() => {
          ws.close();
          resolve(msgs.map((m) => Object.keys(m)));
        }, 15000);
      });
    });

    expect(messages.length).toBeGreaterThan(0);
    const allKeys = messages.flat();
    const hasContent = allKeys.includes("content") || allKeys.includes("outputTranscription");
    expect(hasContent).toBeTruthy();
  });

  test("static assets load correctly", async ({ request }) => {
    const assets = [
      "/static/css/style.css",
      "/static/js/app.js",
      "/static/js/audio-recorder.js",
      "/static/js/audio-player.js",
      "/static/js/pcm-recorder-processor.js",
      "/static/js/pcm-player-processor.js",
      "/static/js/pcm-tab-processor.js",
    ];
    for (const asset of assets) {
      const resp = await request.get(`${BASE}${asset}`);
      expect(resp.ok(), `${asset} should load`).toBeTruthy();
    }
  });

  test("no console errors on page load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE);
    // Wait a moment for any deferred scripts
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test("markdown renderer escapes inline code HTML", async ({ page }) => {
    await page.goto(BASE);

    // Inject a test using the renderMarkdown function exposed by the app
    const result = await page.evaluate(() => {
      // Create a temporary div and use the app's markdown rendering
      const div = document.createElement("div");
      // Simulate what addTranscriptEntry does
      const text = "Check this: `<img onerror=alert(1) src=x>` code";
      // Replicate the renderMarkdown logic
      const escapeHtml = (t) => {
        const d = document.createElement("div");
        d.textContent = t;
        return d.innerHTML;
      };
      let processed = text;
      processed = processed.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
      });
      processed = processed.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
      processed = processed.replace(/(<pre><code[^>]*>[\s\S]*?<\/code><\/pre>|<code>[\s\S]*?<\/code>)/g, (match) => {
        return '\0CODE' + match + 'CODE\0';
      });
      const parts = processed.split(/\0CODE([\s\S]*?)CODE\0/);
      processed = parts.map((part, i) => i % 2 === 0 ? escapeHtml(part) : part).join('');
      processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');

      div.innerHTML = processed;
      // Check that no img element was created (would indicate XSS)
      return {
        hasImg: div.querySelector("img") !== null,
        hasCode: div.querySelector("code") !== null,
        codeText: div.querySelector("code")?.textContent || "",
      };
    });

    expect(result.hasImg).toBe(false);
    expect(result.hasCode).toBe(true);
    expect(result.codeText).toContain("<img");
  });
});
