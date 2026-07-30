"use client";

import { useEffect, useState } from "react";
import { strFromU8, unzip } from "fflate";

type Archive = Record<string, Uint8Array>;
type PptSlide = { title: string; paragraphs: string[]; images: string[] };
type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "table"; rows: string[][] };
type Sheet = { name: string; rows: string[][] };
type PreviewData =
  | { type: "pptx"; slides: PptSlide[] }
  | { type: "docx"; blocks: DocBlock[] }
  | { type: "xlsx"; sheets: Sheet[] };

function parseXml(value: Uint8Array) {
  return new DOMParser().parseFromString(strFromU8(value), "application/xml");
}

function textNodes(element: Element, localName = "t") {
  return Array.from(element.getElementsByTagNameNS("*", localName))
    .map((node) => node.textContent ?? "")
    .join("");
}

function normalizePath(baseFile: string, target: string) {
  const parts = `${baseFile.slice(0, baseFile.lastIndexOf("/") + 1)}${target}`.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function mimeForImage(path: string) {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "image/jpeg";
}

function unzipFile(buffer: ArrayBuffer) {
  return new Promise<Archive>((resolve, reject) => {
    unzip(new Uint8Array(buffer), (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function parsePptx(archive: Archive, registerUrl: (url: string) => void): PreviewData {
  const slidePaths = Object.keys(archive)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));

  const slides = slidePaths.map((slidePath, slideIndex) => {
    const document = parseXml(archive[slidePath]);
    const paragraphs = Array.from(document.getElementsByTagNameNS("*", "p"))
      .map((paragraph) => textNodes(paragraph).trim())
      .filter(Boolean);
    const relationshipPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    const images: string[] = [];
    if (archive[relationshipPath]) {
      const relationships = parseXml(archive[relationshipPath]);
      for (const relation of Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))) {
        if (!(relation.getAttribute("Type") ?? "").endsWith("/image")) continue;
        const target = relation.getAttribute("Target");
        if (!target) continue;
        const imagePath = normalizePath(slidePath, target);
        const image = archive[imagePath];
        if (!image) continue;
        const url = URL.createObjectURL(new Blob([image], { type: mimeForImage(imagePath) }));
        registerUrl(url);
        images.push(url);
      }
    }
    return {
      title: paragraphs[0] || `第 ${slideIndex + 1} 页`,
      paragraphs: paragraphs.slice(1),
      images,
    };
  });

  return { type: "pptx", slides };
}

function parseDocx(archive: Archive): PreviewData {
  const source = archive["word/document.xml"];
  if (!source) throw new Error("没有找到 Word 文档正文");
  const document = parseXml(source);
  const body = Array.from(document.getElementsByTagNameNS("*", "body"))[0];
  const blocks: DocBlock[] = [];

  for (const child of Array.from(body?.children ?? [])) {
    if (child.localName === "p") {
      const text = textNodes(child).trim();
      if (text) blocks.push({ type: "paragraph", text });
    } else if (child.localName === "tbl") {
      const rows = Array.from(child.getElementsByTagNameNS("*", "tr")).map((row) =>
        Array.from(row.getElementsByTagNameNS("*", "tc")).map((cell) => textNodes(cell).trim()),
      );
      if (rows.length) blocks.push({ type: "table", rows });
    }
  }
  return { type: "docx", blocks };
}

function columnIndex(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseXlsx(archive: Archive): PreviewData {
  const workbookSource = archive["xl/workbook.xml"];
  if (!workbookSource) throw new Error("没有找到 Excel 工作簿");
  const workbook = parseXml(workbookSource);
  const relationshipSource = archive["xl/_rels/workbook.xml.rels"];
  const relationships = new Map<string, string>();
  if (relationshipSource) {
    const relationshipDocument = parseXml(relationshipSource);
    for (const relation of Array.from(relationshipDocument.getElementsByTagNameNS("*", "Relationship"))) {
      const id = relation.getAttribute("Id");
      const target = relation.getAttribute("Target");
      if (id && target) relationships.set(id, normalizePath("xl/workbook.xml", target));
    }
  }

  const sharedStrings = archive["xl/sharedStrings.xml"]
    ? Array.from(parseXml(archive["xl/sharedStrings.xml"]).getElementsByTagNameNS("*", "si")).map((item) => textNodes(item))
    : [];

  const sheets = Array.from(workbook.getElementsByTagNameNS("*", "sheet")).map((sheet, sheetIndex) => {
    const relationId =
      sheet.getAttribute("r:id") ??
      sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const sheetPath = (relationId && relationships.get(relationId)) || `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const source = archive[sheetPath];
    const rows: string[][] = [];
    if (source) {
      const sheetDocument = parseXml(source);
      for (const row of Array.from(sheetDocument.getElementsByTagNameNS("*", "row")).slice(0, 300)) {
        const values: string[] = [];
        for (const cell of Array.from(row.getElementsByTagNameNS("*", "c")).slice(0, 50)) {
          const index = columnIndex(cell.getAttribute("r") ?? "A");
          while (values.length < index) values.push("");
          const type = cell.getAttribute("t");
          const raw = textNodes(cell, type === "inlineStr" ? "t" : "v");
          values[index] = type === "s" ? sharedStrings[Number(raw)] ?? "" : raw;
        }
        rows.push(values);
      }
    }
    return { name: sheet.getAttribute("name") || `工作表 ${sheetIndex + 1}`, rows };
  });
  return { type: "xlsx", sheets };
}

export default function OfficePreview({ fileId, fileName }: { fileId: number; fileName: string }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [activeSheet, setActiveSheet] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    setData(null);
    setError("");
    setActiveSheet(0);
    setActiveSlide(0);

    async function load() {
      try {
        const response = await fetch(`/api/files/${fileId}/preview`);
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "文件读取失败");
        }
        const archive = await unzipFile(await response.arrayBuffer());
        if (cancelled) return;
        const registerUrl = (url: string) => objectUrls.push(url);
        if (/\.pptx$/i.test(fileName)) setData(parsePptx(archive, registerUrl));
        else if (/\.docx$/i.test(fileName)) setData(parseDocx(archive));
        else if (/\.xlsx$/i.test(fileName)) setData(parseXlsx(archive));
        else throw new Error("旧版 Office 文件暂不支持网页预览，请先另存为 PPTX、DOCX 或 XLSX");
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "预览加载失败");
      }
    }

    void load();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [fileId, fileName]);

  if (error) {
    return (
      <div className="office-preview-state">
        <span>!</span>
        <h3>预览没有加载成功</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="office-preview-state">
        <span className="preview-loader" />
        <h3>正在生成网页预览…</h3>
        <p>大文件可能需要稍等一会儿</p>
      </div>
    );
  }

  if (data.type === "pptx") {
    const slide = data.slides[activeSlide];
    if (!slide) {
      return (
        <div className="office-preview-state">
          <span>!</span>
          <h3>这份演示文稿没有可显示的页面</h3>
        </div>
      );
    }
    return (
      <div className="ppt-preview">
        <div className="ppt-preview-toolbar">
          <button
            disabled={activeSlide === 0}
            onClick={() => setActiveSlide((current) => Math.max(0, current - 1))}
          >
            ← 上一页
          </button>
          <strong>第 {activeSlide + 1} 页 / 共 {data.slides.length} 页</strong>
          <button
            disabled={activeSlide === data.slides.length - 1}
            onClick={() => setActiveSlide((current) => Math.min(data.slides.length - 1, current + 1))}
          >
            下一页 →
          </button>
        </div>
        <div className="ppt-stage">
          <article className="ppt-slide" aria-live="polite">
            <span className="slide-number">{activeSlide + 1}</span>
            <div className="ppt-slide-copy">
              <h3>{slide.title}</h3>
              {slide.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
            </div>
            {slide.images.length > 0 && (
              <div className="ppt-slide-images">
                {slide.images.map((image, imageIndex) => <img key={imageIndex} src={image} alt={`第 ${activeSlide + 1} 页图片`} />)}
              </div>
            )}
          </article>
        </div>
      </div>
    );
  }

  if (data.type === "docx") {
    return (
      <article className="word-preview">
        {data.blocks.map((block, index) =>
          block.type === "paragraph" ? (
            <p key={index}>{block.text}</p>
          ) : (
            <div className="office-table-scroll" key={index}>
              <table><tbody>{block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
              ))}</tbody></table>
            </div>
          ),
        )}
      </article>
    );
  }

  const sheet = data.sheets[activeSheet];
  return (
    <div className="excel-preview">
      <div className="sheet-tabs">
        {data.sheets.map((item, index) => (
          <button className={activeSheet === index ? "active" : ""} key={index} onClick={() => setActiveSheet(index)}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="office-table-scroll">
        <table>
          <tbody>
            {sheet?.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th>{rowIndex + 1}</th>
                {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
