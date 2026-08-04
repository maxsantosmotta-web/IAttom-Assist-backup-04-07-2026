import fs from "node:fs";

const pickerPath = new URL("../src/components/creative/ImageMotionSourcePicker.tsx", import.meta.url);
let picker = fs.readFileSync(pickerPath, "utf8");

if (!picker.includes('import { useUser } from "@clerk/react";')) {
  const anchor = 'import { useEffect, useRef, useState } from "react";';
  if (!picker.includes(anchor)) throw new Error("ImageMotionSourcePicker React import anchor not found");
  picker = picker.replace(anchor, `${anchor}\nimport { useUser } from "@clerk/react";`);
}

picker = picker.replace(
  '  getSavedImageLibraryCache,\n  loadSavedImageLibrary,',
  '  getSavedImageLibraryCache,\n  loadSavedImageLibrary,',
);

const pickerFunction = 'export function ImageMotionSourcePicker({ value, onChange, onExit, disabled = false, resetSignal = 0 }: ImageMotionSourcePickerProps) {';
const pickerScopedStart = `${pickerFunction}\n  const { user } = useUser();\n  const browserOwnerId = user?.id ?? "anonymous";\n  const userScopedDraftProjectId = \`${'${DRAFT_PROJECT_ID}'}:${'${browserOwnerId}'}\`;`;
if (!picker.includes("const userScopedDraftProjectId")) {
  if (!picker.includes(pickerFunction)) throw new Error("ImageMotionSourcePicker function anchor not found");
  picker = picker.replace(pickerFunction, pickerScopedStart);
}

picker = picker
  .replace('useState<SavedImageLibraryEntry[]>(() => getSavedImageLibraryCache())', 'useState<SavedImageLibraryEntry[]>(() => getSavedImageLibraryCache(browserOwnerId))')
  .replaceAll('loadProjectAssets(DRAFT_PROJECT_ID)', 'loadProjectAssets(userScopedDraftProjectId)')
  .replaceAll('deleteProjectAssets(DRAFT_PROJECT_ID)', 'deleteProjectAssets(userScopedDraftProjectId)')
  .replaceAll('saveProjectAssets(DRAFT_PROJECT_ID,', 'saveProjectAssets(userScopedDraftProjectId,')
  .replaceAll('const cached = getSavedImageLibraryCache();', 'const cached = getSavedImageLibraryCache(browserOwnerId);')
  .replaceAll('loadSavedImageLibrary(getItems, getItemAssets)', 'loadSavedImageLibrary(getItems, getItemAssets, false, browserOwnerId)');

if (!picker.includes('loadProjectAssets(userScopedDraftProjectId)') ||
    !picker.includes('saveProjectAssets(userScopedDraftProjectId,') ||
    !picker.includes('getSavedImageLibraryCache(browserOwnerId)') ||
    !picker.includes('loadSavedImageLibrary(getItems, getItemAssets, false, browserOwnerId)')) {
  throw new Error("ImageMotionSourcePicker user isolation markers missing");
}

fs.writeFileSync(pickerPath, picker);

const executionPath = new URL("../src/components/creative/ImageMotionExecution.tsx", import.meta.url);
let execution = fs.readFileSync(executionPath, "utf8");

if (!execution.includes('import { useUser } from "@clerk/react";')) {
  const anchor = 'import { useEffect, useMemo, useRef, useState } from "react";';
  if (!execution.includes(anchor)) throw new Error("ImageMotionExecution React import anchor not found");
  execution = execution.replace(anchor, `${anchor}\nimport { useUser } from "@clerk/react";`);
}

const executionFunction = 'export function ImageMotionExecution({ source, prompt, platform, formats, onNew }: ImageMotionExecutionProps) {';
const executionScopedStart = `${executionFunction}\n  const { user } = useUser();\n  const browserOwnerId = user?.id ?? "anonymous";\n  const storageKey = \`${'${STORAGE_KEY}'}:${'${browserOwnerId}'}\`;`;
if (!execution.includes("const storageKey =")) {
  if (!execution.includes(executionFunction)) throw new Error("ImageMotionExecution function anchor not found");
  execution = execution.replace(executionFunction, executionScopedStart);
}

execution = execution
  .replaceAll('localStorage.getItem(STORAGE_KEY)', 'localStorage.getItem(storageKey)')
  .replaceAll('localStorage.setItem(STORAGE_KEY,', 'localStorage.setItem(storageKey,')
  .replaceAll('localStorage.removeItem(STORAGE_KEY)', 'localStorage.removeItem(storageKey)');

if (!execution.includes('localStorage.getItem(storageKey)') ||
    !execution.includes('localStorage.setItem(storageKey,') ||
    !execution.includes('localStorage.removeItem(storageKey)')) {
  throw new Error("ImageMotionExecution per-user storage markers missing");
}

fs.writeFileSync(executionPath, execution);

const libraryPath = new URL("../src/lib/savedImageLibrary.ts", import.meta.url);
let library = fs.readFileSync(libraryPath, "utf8");

const oldCacheBlock = `let cache: { entries: SavedImageLibraryEntry[]; fetchedAt: number } | null = null;
let pendingRequest: Promise<SavedImageLibraryEntry[]> | null = null;

export function getSavedImageLibraryCache(): SavedImageLibraryEntry[] {
  return cache?.entries ?? [];
}

export function clearSavedImageLibraryCache(): void {
  cache = null;
}`;

const scopedCacheBlock = `const cacheByOwner = new Map<string, { entries: SavedImageLibraryEntry[]; fetchedAt: number }>();
const pendingByOwner = new Map<string, Promise<SavedImageLibraryEntry[]>>();

export function getSavedImageLibraryCache(ownerId = "anonymous"): SavedImageLibraryEntry[] {
  return cacheByOwner.get(ownerId)?.entries ?? [];
}

export function clearSavedImageLibraryCache(ownerId?: string): void {
  if (ownerId) {
    cacheByOwner.delete(ownerId);
    pendingByOwner.delete(ownerId);
    return;
  }
  cacheByOwner.clear();
  pendingByOwner.clear();
}`;

if (library.includes(oldCacheBlock)) {
  library = library.replace(oldCacheBlock, scopedCacheBlock);
} else if (!library.includes("const cacheByOwner")) {
  throw new Error("Saved image library cache block not found");
}

library = library.replace(
  `  force = false,\n): Promise<SavedImageLibraryEntry[]> {\n  const now = Date.now();\n  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.entries;\n  if (pendingRequest) return pendingRequest;\n\n  pendingRequest = (async () => {`,
  `  force = false,\n  ownerId = "anonymous",\n): Promise<SavedImageLibraryEntry[]> {\n  const now = Date.now();\n  const ownerCache = cacheByOwner.get(ownerId);\n  if (!force && ownerCache && now - ownerCache.fetchedAt < CACHE_TTL_MS) return ownerCache.entries;\n  const existingPending = pendingByOwner.get(ownerId);\n  if (existingPending) return existingPending;\n\n  const request = (async () => {`,
);

library = library
  .replace('    cache = { entries, fetchedAt: Date.now() };', '    cacheByOwner.set(ownerId, { entries, fetchedAt: Date.now() });')
  .replace(`  })().finally(() => {\n    pendingRequest = null;\n  });\n\n  return pendingRequest;`, `  })().finally(() => {\n    pendingByOwner.delete(ownerId);\n  });\n\n  pendingByOwner.set(ownerId, request);\n  return request;`);

if (!library.includes('ownerId = "anonymous"') ||
    !library.includes('cacheByOwner.get(ownerId)') ||
    !library.includes('pendingByOwner.set(ownerId, request)')) {
  throw new Error("Saved image library per-user cache markers missing");
}

fs.writeFileSync(libraryPath, library);

const creativePath = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let creative = fs.readFileSync(creativePath, "utf8");

if (!creative.includes('import { useUser } from "@clerk/react";')) {
  const anchor = 'import { useState, useEffect, useRef } from "react";';
  if (!creative.includes(anchor)) throw new Error("CreativeGenerator React import anchor not found");
  creative = creative.replace(anchor, `${anchor}\nimport { useUser } from "@clerk/react";`);
}

const creativeFunction = 'export function CreativeGenerator() {';
const creativeScopedStart = `${creativeFunction}\n  const { user } = useUser();\n  const imageMotionOwnerId = user?.id ?? "anonymous";\n  const imageMotionStorageKey = (kind: string) => \`iattom_image_motion_${'${kind}'}_v1:${'${imageMotionOwnerId}'}\`;`;
if (!creative.includes("const imageMotionStorageKey")) {
  if (!creative.includes(creativeFunction)) throw new Error("CreativeGenerator function anchor not found");
  creative = creative.replace(creativeFunction, creativeScopedStart);
}

creative = creative
  .replaceAll('"iattom_image_motion_prompt_v1"', 'imageMotionStorageKey("prompt")')
  .replaceAll('"iattom_image_motion_platform_v1"', 'imageMotionStorageKey("platform")')
  .replaceAll('"iattom_image_motion_formats_v1"', 'imageMotionStorageKey("formats")')
  .replaceAll('"iattom_image_motion_execution_v1"', 'imageMotionStorageKey("execution")');

if (!creative.includes('imageMotionStorageKey("prompt")') ||
    !creative.includes('imageMotionStorageKey("platform")') ||
    !creative.includes('imageMotionStorageKey("formats")')) {
  throw new Error("CreativeGenerator image-motion storage keys were not scoped");
}

fs.writeFileSync(creativePath, creative);

console.log("Image-motion draft, execution and library cache are isolated per authenticated browser user.");
