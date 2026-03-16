// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:8000",
    headless: true,
  },
  webServer: {
    command: "python app/main.py",
    port: 8000,
    timeout: 15000,
    reuseExistingServer: true,
  },
});
