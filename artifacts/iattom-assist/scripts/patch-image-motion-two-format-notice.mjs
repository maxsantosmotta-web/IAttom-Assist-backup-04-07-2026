import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const simpleStateAnchor = `  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>([]);`;
const persistedStateEnd = `  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>(() => {
    try {
      const direct = localStorage.getItem("iattom_image_motion_formats_v1");
      const raw = localStorage.getItem("iattom_image_motion_execution_v1");
      const saved = raw ? JSON.parse(raw) as { formats?: unknown } : null;
      const candidate = direct ? JSON.parse(direct) : saved?.formats;
      if (!Array.isArray(candidate)) return [];
      return candidate.filter((format): format is string => ["vertical", "horizontal", "automatic"].includes(String(format))).slice(0, MAX_FORMATS);
    } catch { return []; }
  });`;

if (!source.includes("const [showTwoFormatsNotice, setShowTwoFormatsNotice]")) {
  if (source.includes(simpleStateAnchor)) {
    source = source.replace(simpleStateAnchor, `${simpleStateAnchor}\n  const [showTwoFormatsNotice, setShowTwoFormatsNotice] = useState(false);`);
  } else if (source.includes(persistedStateEnd)) {
    source = source.replace(persistedStateEnd, `${persistedStateEnd}\n  const [showTwoFormatsNotice, setShowTwoFormatsNotice] = useState(false);`);
  } else {
    throw new Error("Image-motion formats state marker was not found");
  }
}

const simpleToggle = `                                  setImageMotionFormats((current) => current.includes(f.key)
                                     ? current.filter((key) => key !== f.key)
                                     : current.length < MAX_FORMATS ? [...current, f.key] : current);`;

const persistedToggle = `                                  setImageMotionFormats((current) => {
                                     const next = current.includes(f.key)
                                       ? current.filter((key) => key !== f.key)
                                       : current.length < MAX_FORMATS ? [...current, f.key] : current;
                                     try {
                                       if (next.length > 0) localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next));
                                       else localStorage.removeItem("iattom_image_motion_formats_v1");
                                     } catch { /* estado React continua sendo a fonte ativa */ }
                                     return next;
                                   });`;

const noticeToggle = `                                  setImageMotionFormats((current) => {
                                     if (current.includes(f.key)) {
                                       const next = current.filter((key) => key !== f.key);
                                       try {
                                         if (next.length > 0) localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next));
                                         else localStorage.removeItem("iattom_image_motion_formats_v1");
                                       } catch { /* estado React continua sendo a fonte ativa */ }
                                       return next;
                                     }
                                     if (current.length >= MAX_FORMATS) return current;
                                     const next = [...current, f.key];
                                     try { localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next)); } catch { /* estado React continua sendo a fonte ativa */ }
                                     if (current.length === 1) setShowTwoFormatsNotice(true);
                                     return next;
                                   });`;

if (!source.includes("if (current.length === 1) setShowTwoFormatsNotice(true);")) {
  if (source.includes(persistedToggle)) source = source.replace(persistedToggle, noticeToggle);
  else if (source.includes(simpleToggle)) source = source.replace(simpleToggle, noticeToggle);
  else throw new Error("Image-motion format toggle marker was not found");
}

const dialogMarker = `    {/* ── Dialog: Onde salvar o criativo ── */}`;
const noticeDialog = `    {/* ── Aviso: dois formatos usam enquadramentos diferentes ── */}
    <Dialog open={showTwoFormatsNotice} onOpenChange={setShowTwoFormatsNotice}>
      <DialogContent className="bg-[#111111] border-white/10 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base text-white">Atenção ao enquadramento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Ao gerar a mesma imagem em dois formatos, ela será adaptada para proporções diferentes. Por isso, um dos formatos poderá apresentar cortes nas laterais para preencher corretamente o enquadramento.
        </p>
        <DialogFooter className="mt-3">
          <Button type="button" onClick={() => setShowTwoFormatsNotice(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

${dialogMarker}`;
if (!source.includes("Atenção ao enquadramento")) {
  if (!source.includes(dialogMarker)) throw new Error("Creative save dialog marker was not found");
  source = source.replace(dialogMarker, noticeDialog);
}

if (!source.includes("if (current.length === 1) setShowTwoFormatsNotice(true);")) throw new Error("Second-format notice trigger was not installed");
if (!source.includes("Ao gerar a mesma imagem em dois formatos")) throw new Error("Second-format notice copy was not installed");
if (!source.includes(`onOpenChange={setShowTwoFormatsNotice}`)) throw new Error("Second-format notice cannot close from the overlay");
if (!source.includes('localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next))')) throw new Error("Second-format notice must preserve format persistence");

writeFileSync(creativeUrl, source);
console.log("Image-motion shows an informational framing notice exactly when the second format is selected.");