import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const api = process.env.API_URL ?? 'http://localhost:4000';
export default defineConfig({
  build: { rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'leaflet', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)/ }, { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)/ }] } } } }, plugins: [react()], server: { port: 5173, proxy: { '/api': api, '/uploads': api } }, preview: { port: 5173, proxy: { '/api': api, '/uploads': api } } });
