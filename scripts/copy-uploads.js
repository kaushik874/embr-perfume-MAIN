#!/usr/bin/env node
/**
 * copy-uploads.js
 * Copies public/uploads into dist/public/uploads so that user-uploaded images
 * (hero banners, product images, about images, etc.) are included in the
 * production build output and served correctly on deployment.
 *
 * Also copies public/images so static assets (logos, SVGs, etc.) are present.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`[copy-uploads] Source not found, skipping: ${src}`);
    return 0;
  }
  fs.mkdirSync(dest, { recursive: true });

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

const srcUploads = path.join(projectRoot, "public", "uploads");
const destUploads = path.join(projectRoot, "dist", "public", "uploads");

const srcImages = path.join(projectRoot, "public", "images");
const destImages = path.join(projectRoot, "dist", "public", "images");

const srcRobots = path.join(projectRoot, "public", "robots.txt");
const destRobots = path.join(projectRoot, "dist", "public", "robots.txt");

const srcSitemap = path.join(projectRoot, "public", "sitemap.xml");
const destSitemap = path.join(projectRoot, "dist", "public", "sitemap.xml");

let total = 0;

total += copyDirRecursive(srcUploads, destUploads);
console.log(`[copy-uploads] Copied uploads → dist/public/uploads`);

total += copyDirRecursive(srcImages, destImages);
console.log(`[copy-uploads] Copied images → dist/public/images`);

if (fs.existsSync(srcRobots)) {
  fs.mkdirSync(path.dirname(destRobots), { recursive: true });
  fs.copyFileSync(srcRobots, destRobots);
  total++;
}

if (fs.existsSync(srcSitemap)) {
  fs.mkdirSync(path.dirname(destSitemap), { recursive: true });
  fs.copyFileSync(srcSitemap, destSitemap);
  total++;
}

console.log(`[copy-uploads] Done — ${total} files copied to dist/public/`);
