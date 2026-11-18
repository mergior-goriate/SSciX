import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.SSCIX_WEB_URL ?? "http://localhost:3000",
    launchOptions: { executablePath: process.env.SSCIX_CHROMIUM_PATH },
  },
});
