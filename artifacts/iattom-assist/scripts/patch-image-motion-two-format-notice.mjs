import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const noticeState = `  const [showTwoFormatsNotice, setShowTwoFormatsNotice] = useState(false);`;
if (!source.includes(noticeState)) {
  const formatsStateStart = source.indexOf(`  const [imageMotionFormats, setImageMotionFormats]`);
  if (formatsStateStart < 0) throw new Error("Image-motion formats state was not found");

  const formatsStateEnd = source.indexOf(`\n  });`, formatsStateStart);
  const simpleFormatsStateEnd = source.indexOf(`;`, formatsStateStart);
  const insertionEnd = formatsStateEnd >= 0 && formatsStateEnd < formatsStateStart + 1600
    ? formatsStateEnd + `\n  });`.length
    : simpleFormatsStateEnd + 1;

  if (insertionEnd <= formatsStateStart) throw new Error("Image-motion formats state end was not found");
  source = source.slice(0, insertionEnd) + `\n${noticeState}` + source.slice(insertionEnd);
}

const noticeTrigger = `if (current.length === 1 && next.length === 2) setShowTwoFormatsNotice(true);`;
if (!source.includes(noticeTrigger)) {
  const persistenceMarker = `localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next))`;
  const persistenceIndex = source.indexOf(persistenceMarker);
  if (persistenceIndex < 0) throw new Error("Image-motion format persistence marker was not found");

  const returnIndex = source.indexOf(`return next;`, persistenceIndex);
  if (returnIndex < 0 || returnIndex > persistenceIndex + 1200) {
    throw new Error("Image-motion format return point was not found");
  }

  const lineStart = source.lastIndexOf("\n", returnIndex) + 1;
  const indentation = source.slice(lineStart, returnIndex);
  source = source.slice(0, lineStart)
    + `${indentation}${noticeTrigger}\n`
    + source.slice(lineStart);
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

if (!source.includes(noticeState)) throw new Error("Second-format notice state was not installed");
if (!source.includes(noticeTrigger)) throw new Error("Second-format notice trigger was not installed");
if (!source.includes("Ao gerar a mesma imagem em dois formatos")) throw new Error("Second-format notice copy was not installed");
if (!source.includes(`onOpenChange={setShowTwoFormatsNotice}`)) throw new Error("Second-format notice cannot close from the overlay");
if (!source.includes('localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next))')) {
  throw new Error("Second-format notice must preserve format persistence");
}

writeFileSync(creativeUrl, source);
console.log("Image-motion framing notice is installed structurally when selection changes from one to two formats.");
