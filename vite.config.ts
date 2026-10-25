import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), solid()],
  test: {
    environment: "jsdom",
  },
});
