import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isServing = mode === "development" || mode === "serve";
  const plugins = [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    // Cloudflare plugin — only needed for production builds to Workers.
    // In dev, Vite handles SSR via its native middleware.
    ...(isServing ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    ...(tanstackStart({
      vite: {
        server: {
          port: 3000,
        },
      },
      server: {
        entry: "server",
      },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }) as Array<{ name: string }>),
    react(),
  ];

  return {
    plugins,
    server: {
      port: 3000,
    },
  };
});
