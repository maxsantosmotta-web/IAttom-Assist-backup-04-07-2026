import { readFileSync, writeFileSync } from "node:fs";

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let source = readFileSync(trashUrl, "utf8");

const oldImport = 'import { useState, useEffect } from "react";';
const newImport = 'import { useState, useEffect, useRef } from "react";';
if (!source.includes(newImport)) {
  if (!source.includes(oldImport)) throw new Error("Trash React import marker not found");
  source = source.replace(oldImport, newImport);
}

const stateMarker = `  const [loading, setLoading]                   = useState(true);
  const [filter, setFilter]                     = useState<FilterCategory>("all");`;
const stateReplacement = `  const [loading, setLoading]                   = useState(true);
  const mountedRef = useRef(true);
  const loadAllInFlightRef = useRef(false);
  const backgroundRetryRef = useRef<number | null>(null);
  const [filter, setFilter]                     = useState<FilterCategory>("all");`;
if (!source.includes("const loadAllInFlightRef = useRef(false);")) {
  if (!source.includes(stateMarker)) throw new Error("Trash state marker not found");
  source = source.replace(stateMarker, stateReplacement);
}

const oldLoadAll = `  const loadAll = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      loadProjects(),
      loadPrompts(),
      loadActivities(),
      loadIntegrations(),
    ]);
    setLoading(false);

    if (results.every((result) => result.status === "rejected")) {
      toast({
        title: "Não foi possível carregar a Lixeira.",
        description: "Os itens anteriores foram preservados. Use Atualizar em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);`;

const newLoadAll = `  const loadAll = async () => {
    if (loadAllInFlightRef.current) return;
    loadAllInFlightRef.current = true;
    if (mountedRef.current) setLoading(true);

    const retryDelays = [0, 800, 1600, 3000, 5000, 8000, 10000];

    try {
      for (const delay of retryDelays) {
        if (!mountedRef.current) return;
        if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (!mountedRef.current) return;

        const results = await Promise.allSettled([
          loadProjects(),
          loadPrompts(),
          loadActivities(),
          loadIntegrations(),
        ]);

        const projectsLoaded = results[0]?.status === "fulfilled";
        const allLoaded = results.every((result) => result.status === "fulfilled");

        if (projectsLoaded) {
          if (mountedRef.current) setLoading(false);

          if (!allLoaded && mountedRef.current && backgroundRetryRef.current === null) {
            backgroundRetryRef.current = window.setTimeout(() => {
              backgroundRetryRef.current = null;
              void loadAll();
            }, 10000);
          }
          return;
        }
      }

      if (mountedRef.current && backgroundRetryRef.current === null) {
        backgroundRetryRef.current = window.setTimeout(() => {
          backgroundRetryRef.current = null;
          void loadAll();
        }, 10000);
      }
    } finally {
      loadAllInFlightRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadAll();
    return () => {
      mountedRef.current = false;
      if (backgroundRetryRef.current !== null) {
        window.clearTimeout(backgroundRetryRef.current);
        backgroundRetryRef.current = null;
      }
    };
  }, []);`;

if (!source.includes("const retryDelays = [0, 800, 1600, 3000, 5000, 8000, 10000];")) {
  if (!source.includes(oldLoadAll)) throw new Error("Trash coordinated loader marker not found");
  source = source.replace(oldLoadAll, newLoadAll);
}

for (const marker of [
  'import { useState, useEffect, useRef } from "react";',
  "const loadAllInFlightRef = useRef(false);",
  "const retryDelays = [0, 800, 1600, 3000, 5000, 8000, 10000];",
  'const projectsLoaded = results[0]?.status === "fulfilled";',
  "backgroundRetryRef.current = window.setTimeout",
  "mountedRef.current = false;",
]) {
  if (!source.includes(marker)) throw new Error(`Trash automatic recovery marker missing: ${marker}`);
}

writeFileSync(trashUrl, source, "utf8");
console.log("Trash now keeps loading and retries automatically until persisted projects are recovered.");
