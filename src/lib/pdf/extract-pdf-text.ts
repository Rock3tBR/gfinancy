import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfTextItem = {
  str: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

type PositionedTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  hasEOL: boolean;
};

function rebuildPageLines(items: PdfTextItem[]) {
  const positioned: PositionedTextItem[] = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      text: item.str.trim(),
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0),
      width: Number(item.width ?? 0),
      hasEOL: Boolean(item.hasEOL),
    }));

  if (!positioned.length) {
    return "";
  }

  const tolerance = 2.5;

  const lines: Array<{
    y: number;
    items: PositionedTextItem[];
  }> = [];

  const sortedItems = [...positioned].sort(
    (first, second) => second.y - first.y || first.x - second.x,
  );

  for (const item of sortedItems) {
    const existingLine = lines.find(
      (line) => Math.abs(line.y - item.y) <= tolerance,
    );

    if (existingLine) {
      existingLine.items.push(item);
    } else {
      lines.push({
        y: item.y,
        items: [item],
      });
    }
  }

  return lines
    .sort((first, second) => second.y - first.y)
    .map((line) => {
      const orderedItems = [...line.items].sort(
        (first, second) => first.x - second.x,
      );

      let lineText = "";
      let previousItem: PositionedTextItem | null = null;

      for (const item of orderedItems) {
        if (!previousItem) {
          lineText = item.text;
          previousItem = item;
          continue;
        }

        const previousEnd = previousItem.x + previousItem.width;
        const distance = item.x - previousEnd;

        const separator = distance > 1 ? " " : "";

        lineText += `${separator}${item.text}`;
        previousItem = item;
      }

      return lineText.replace(/\s+/g, " ").trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");
}

function getPdfTextItems(items: unknown[]): PdfTextItem[] {
  return items.flatMap((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("str" in item) ||
      typeof item.str !== "string"
    ) {
      return [];
    }

    const transform =
      "transform" in item && Array.isArray(item.transform)
        ? item.transform.map(Number)
        : undefined;

    const width =
      "width" in item && typeof item.width === "number"
        ? item.width
        : undefined;

    const hasEOL =
      "hasEOL" in item && typeof item.hasEOL === "boolean"
        ? item.hasEOL
        : undefined;

    return [
      {
        str: item.str,
        transform,
        width,
        hasEOL,
      },
    ];
  });
}

export async function extractTextFromPdf(file: File): Promise<string> {
  if (!file) {
    throw new Error("Arquivo não informado.");
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("O arquivo precisa ser um PDF.");
  }

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pdfTextItems = getPdfTextItems(
      textContent.items as unknown[],
    );

    const pageText = rebuildPageLines(pdfTextItems);

    pages.push(
      `--- PÁGINA ${pageNumber} ---\n${pageText}`,
    );

    page.cleanup();
  }

  const fullText = pages.join("\n\n").trim();

  if (!fullText || fullText.length < 30) {
    throw new Error(
      "Não consegui ler texto suficiente desse PDF. Ele pode ser escaneado ou formado por imagens e precisar de OCR.",
    );
  }

  return fullText;
}