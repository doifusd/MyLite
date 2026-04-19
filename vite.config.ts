import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 1420,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
    reportCompressedSize: false,
    rollupOptions: {
      external: [
        'monaco-editor',  // 从 CDN 加载，不打包
      ],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-context-menu'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tauri-apps/api'],
    exclude: ['monaco-editor'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
});
