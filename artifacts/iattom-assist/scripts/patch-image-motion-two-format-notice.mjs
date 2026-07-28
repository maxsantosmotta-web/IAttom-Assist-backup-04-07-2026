import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const stateAnchor = `  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>([]);`;
const stateWithNotice = `${stateAnchor}\n  const [showTwoFormatsNotice, setShowTwoFormatsNotice] = useState(false);`;
if (!source.includes("showTwoFormatsNotice")) {
  if (!source.includes(stateAnchor)) throw new Error("Image-motion formats state marker was not found");
  source = source.replace(stateAnchor, stateWithNotice);
}

const oldToggle = `                                  setImageMotionFormats((current) => current.includes(f.key)
                                    ? current.filter((key) => key !== f.key)
                                    : current.length < MAX_FORMATS ? [...current, f.key] : current);`;
const newToggle = `                                  setImageMotionFormats((current) => {
                                    if (current.includes(f.key)) return current.filter((key) => key !== f.key);
                                    if (current.length >= MAX_FORMATS) return current;
                                    const next = [...current, f.key];
                                    if (current.length === 1) setShowTwoFormatsNotice(true);
                                    return next;
                                  });`;
if (!source.includes(newToggle)) {
  if (!source.includes(oldToggle)) throw new Error("Image-motion format toggle marker was not found");
  source = source.replace(oldToggle, newToggle);
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

writeFileSync(creativeUrl, source);
console.log("Image-motion shows an informational framing notice exactly when the second format is selected.");
