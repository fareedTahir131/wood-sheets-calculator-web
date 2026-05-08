const MM_PER_FOOT = 304.8;
const DEFAULT_SHEET = {
  length: 8 * MM_PER_FOOT,
  width: 4 * MM_PER_FOOT,
};

const stockItems = [];
const pieceItems = [];

const unitConfig = {
  ft: { label: "ft", toMm: MM_PER_FOOT, precision: 2 },
  in: { label: "in", toMm: 25.4, precision: 2 },
  m: { label: "m", toMm: 1000, precision: 3 },
  cm: { label: "cm", toMm: 10, precision: 1 },
  mm: { label: "mm", toMm: 1, precision: 0 },
};

let currentUnit = "ft";
let lastResult = null;

const els = {
  stockMaterial: document.getElementById("stock-material"),
  stockLength: document.getElementById("stock-length"),
  stockWidth: document.getElementById("stock-width"),
  stockCount: document.getElementById("stock-count"),
  pieceMaterial: document.getElementById("piece-material"),
  pieceLength: document.getElementById("piece-length"),
  pieceWidth: document.getElementById("piece-width"),
  pieceQty: document.getElementById("piece-qty"),
  unitSelect: document.getElementById("unit-select"),
  stockBody: document.querySelector("#stock-table tbody"),
  pieceBody: document.querySelector("#piece-table tbody"),
  calculate: document.getElementById("calculate"),
  loadDemo: document.getElementById("load-demo"),
  clearAll: document.getElementById("clear-all"),
  addStock: document.getElementById("add-stock"),
  addPiece: document.getElementById("add-piece"),
  results: document.getElementById("results"),
  resultUnit: document.getElementById("result-unit"),
  summary: document.getElementById("summary"),
  warnings: document.getElementById("warnings"),
  legend: document.getElementById("legend"),
  layouts: document.getElementById("layouts"),
};

els.unitSelect.value = currentUnit;
els.addStock.addEventListener("click", onAddStock);
els.addPiece.addEventListener("click", onAddPiece);
els.calculate.addEventListener("click", onCalculate);
els.loadDemo.addEventListener("click", onLoadDemo);
els.clearAll.addEventListener("click", onClearAll);
els.unitSelect.addEventListener("change", onUnitChange);

renderStockTable();
renderPieceTable();

function onUnitChange() {
  currentUnit = els.unitSelect.value;
  renderStockTable();
  renderPieceTable();

  if (lastResult) {
    renderResults(lastResult);
  }
}

function onAddStock() {
  const material = cleanText(els.stockMaterial.value);
  const length = toMm(parsePositive(els.stockLength.value));
  const width = toMm(parsePositive(els.stockWidth.value));
  const available = parseWholeNumber(els.stockCount.value);

  if (!material || !length || !width || !available) {
    alert("Please fill all stock fields with valid positive values.");
    return;
  }

  stockItems.push({
    id: makeId(),
    material,
    length,
    width,
    available,
  });

  clearStockInputs();
  renderStockTable();
}

function onAddPiece() {
  const material = cleanText(els.pieceMaterial.value);
  const length = toMm(parsePositive(els.pieceLength.value));
  const width = toMm(parsePositive(els.pieceWidth.value));
  const qty = parseWholeNumber(els.pieceQty.value);

  if (!material || !length || !width || !qty) {
    alert("Please fill all piece fields with valid positive values.");
    return;
  }

  pieceItems.push({
    id: makeId(),
    material,
    length,
    width,
    qty,
  });

  clearPieceInputs();
  renderPieceTable();
}

function onCalculate() {
  if (!pieceItems.length) {
    alert("Please add required pieces first.");
    return;
  }

  lastResult = planCutting(stockItems, pieceItems);
  renderResults(lastResult);
}

function onLoadDemo() {
  stockItems.length = 0;
  pieceItems.length = 0;

  stockItems.push(
    { id: makeId(), material: "MDF", length: 8 * MM_PER_FOOT, width: 4 * MM_PER_FOOT, available: 4 },
    { id: makeId(), material: "Chipboard", length: 9 * MM_PER_FOOT, width: 6 * MM_PER_FOOT, available: 2 }
  );

  pieceItems.push(
    { id: makeId(), material: "MDF", length: 7 * MM_PER_FOOT, width: 1.6 * MM_PER_FOOT, qty: 2 },
    { id: makeId(), material: "MDF", length: 3 * MM_PER_FOOT, width: 1.5 * MM_PER_FOOT, qty: 6 },
    { id: makeId(), material: "MDF", length: 2.5 * MM_PER_FOOT, width: 1.25 * MM_PER_FOOT, qty: 4 },
    { id: makeId(), material: "Chipboard", length: 5 * MM_PER_FOOT, width: 2 * MM_PER_FOOT, qty: 3 },
    { id: makeId(), material: "Laminate", length: 6 * MM_PER_FOOT, width: 1 * MM_PER_FOOT, qty: 5 }
  );

  lastResult = null;
  renderStockTable();
  renderPieceTable();
  els.results.classList.add("hidden");
}

function onClearAll() {
  stockItems.length = 0;
  pieceItems.length = 0;
  lastResult = null;
  renderStockTable();
  renderPieceTable();
  els.results.classList.add("hidden");
  els.summary.innerHTML = "";
  els.warnings.innerHTML = "";
  els.legend.innerHTML = "";
  els.layouts.innerHTML = "";
}

function renderStockTable() {
  els.stockBody.innerHTML = "";

  if (!stockItems.length) {
    els.stockBody.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">No stock added. Calculator will use assumed ${formatDim(DEFAULT_SHEET.length)} x ${formatDim(DEFAULT_SHEET.width)} ${unitLabel()} sheets.</td>
      </tr>
    `;
    return;
  }

  for (const item of stockItems) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.material)}</td>
      <td>${formatDim(item.length)} x ${formatDim(item.width)} ${unitLabel()}</td>
      <td>${item.available}</td>
      <td><button class="btn" type="button" data-remove-stock="${item.id}">Remove</button></td>
    `;
    els.stockBody.appendChild(tr);
  }

  els.stockBody.querySelectorAll("[data-remove-stock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeById(stockItems, btn.getAttribute("data-remove-stock"));
      lastResult = null;
      renderStockTable();
    });
  });
}

function renderPieceTable() {
  els.pieceBody.innerHTML = "";

  if (!pieceItems.length) {
    els.pieceBody.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Add required pieces to calculate sheets.</td>
      </tr>
    `;
    return;
  }

  for (const item of pieceItems) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.material)}</td>
      <td>${formatDim(item.length)} x ${formatDim(item.width)} ${unitLabel()}</td>
      <td>${item.qty}</td>
      <td><button class="btn" type="button" data-remove-piece="${item.id}">Remove</button></td>
    `;
    els.pieceBody.appendChild(tr);
  }

  els.pieceBody.querySelectorAll("[data-remove-piece]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeById(pieceItems, btn.getAttribute("data-remove-piece"));
      lastResult = null;
      renderPieceTable();
    });
  });
}

function planCutting(stocks, pieces) {
  const materialGroups = groupBy(pieces, (p) => materialKey(p.material));
  const sheets = [];
  const summary = [];
  const warnings = [];

  for (const [, matPieces] of materialGroups.entries()) {
    const materialName = matPieces[0].material;
    const matchingStock = stocks
      .filter((stock) => materialKey(stock.material) === materialKey(materialName))
      .map((stock) => ({ ...stock, used: 0, unlimited: false }))
      .sort((a, b) => b.length * b.width - a.length * a.width);

    const usesAssumedSheet = matchingStock.length === 0;
    const sheetSources = usesAssumedSheet
      ? [
          {
            id: `assumed-${materialKey(materialName)}`,
            material: materialName,
            length: DEFAULT_SHEET.length,
            width: DEFAULT_SHEET.width,
            available: Number.POSITIVE_INFINITY,
            used: 0,
            unlimited: true,
          },
        ]
      : matchingStock;

    const requiredUnits = expandPieces(matPieces)
      .sort(sortPieces)
      .map((piece, index) => ({ ...piece, material: materialName, pieceNo: index + 1 }));

    const activeSheets = [];
    const unplaced = [];

    for (const unit of requiredUnits) {
      if (placeInBestSheet(activeSheets, unit)) continue;

      const opened = openBestSheetAndPlace(sheetSources, activeSheets, unit);
      if (!opened) {
        unplaced.push(unit);
      }
    }

    const usedArea = activeSheets.reduce((acc, sheet) => acc + sheet.usedArea, 0);
    const totalArea = activeSheets.reduce((acc, sheet) => acc + sheet.length * sheet.width, 0);
    const remainingStock = usesAssumedSheet
      ? null
      : sheetSources.reduce((acc, stock) => acc + Math.max(stock.available - stock.used, 0), 0);

    summary.push({
      material: materialName,
      source: usesAssumedSheet ? "assumed" : "stock",
      requiredPieces: requiredUnits.length,
      placedPieces: requiredUnits.length - unplaced.length,
      sheetsUsed: activeSheets.length,
      remainingStock,
      utilization: totalArea ? (usedArea / totalArea) * 100 : 0,
      unplacedCount: unplaced.length,
    });

    sheets.push(...activeSheets);

    if (usesAssumedSheet) {
      warnings.push(
        `${materialName}: no stock was added, so the plan uses assumed ${formatDim(DEFAULT_SHEET.length)} x ${formatDim(DEFAULT_SHEET.width)} ${unitLabel()} sheets.`
      );
    }

    if (unplaced.length) {
      for (const warning of buildUnplacedWarnings(materialName, unplaced, usesAssumedSheet)) {
        warnings.push(warning);
      }
    }
  }

  return {
    summary,
    sheets,
    warnings,
    totals: {
      materials: summary.length,
      sheetsUsed: summary.reduce((acc, row) => acc + row.sheetsUsed, 0),
      piecesRequired: summary.reduce((acc, row) => acc + row.requiredPieces, 0),
      piecesPlaced: summary.reduce((acc, row) => acc + row.placedPieces, 0),
    },
  };
}

function openBestSheetAndPlace(sheetSources, activeSheets, piece) {
  let selected = null;

  for (const source of sheetSources) {
    if (!source.unlimited && source.used >= source.available) continue;

    const preview = tryPlaceOnFreshSheet(source, piece);
    if (!preview) continue;

    const score = preview.remainingArea + source.length * source.width * 0.001;
    if (!selected || score < selected.score) {
      selected = { source, preview, score };
    }
  }

  if (!selected) return false;

  selected.source.used += 1;
  const sheet = {
    id: `${selected.source.id || selected.source.material}-${selected.source.used}`,
    material: selected.source.material,
    length: selected.source.length,
    width: selected.source.width,
    source: selected.source.unlimited ? "Assumed sheet" : "Stock sheet",
    sheetNo: selected.source.used,
    placements: [selected.preview.placement],
    freeRects: selected.preview.freeRects,
    usedArea: selected.preview.placement.width * selected.preview.placement.height,
  };

  activeSheets.push(sheet);
  return true;
}

function tryPlaceOnFreshSheet(source, piece) {
  const freeRects = [{ x: 0, y: 0, width: source.width, height: source.length }];
  const fit = choosePlacement(freeRects, piece);
  if (!fit) return null;

  const freeRectsAfterPlacement = splitFreeRects(freeRects, fit.rectIndex, fit.placement);
  return {
    placement: fit.placement,
    freeRects: freeRectsAfterPlacement,
    remainingArea: source.length * source.width - fit.placement.width * fit.placement.height,
  };
}

function placeInBestSheet(activeSheets, piece) {
  let best = null;

  for (let i = 0; i < activeSheets.length; i += 1) {
    const sheet = activeSheets[i];
    const fit = choosePlacement(sheet.freeRects, piece);
    if (!fit) continue;

    const leftoverScore = fit.rect.width * fit.rect.height - fit.placement.width * fit.placement.height;
    const trimScore = Math.abs(fit.rect.width - fit.placement.width) + Math.abs(fit.rect.height - fit.placement.height);
    const score = leftoverScore + trimScore;

    if (!best || score < best.score) {
      best = { sheetIndex: i, fit, score };
    }
  }

  if (!best) return false;

  const sheet = activeSheets[best.sheetIndex];
  sheet.placements.push(best.fit.placement);
  sheet.usedArea += best.fit.placement.width * best.fit.placement.height;
  sheet.freeRects = splitFreeRects(sheet.freeRects, best.fit.rectIndex, best.fit.placement);
  return true;
}

function choosePlacement(freeRects, piece) {
  let best = null;

  for (let i = 0; i < freeRects.length; i += 1) {
    const rect = freeRects[i];
    const options = [
      { width: piece.width, height: piece.length, rotated: false },
      { width: piece.length, height: piece.width, rotated: true },
    ];

    for (const option of options) {
      if (option.width <= rect.width && option.height <= rect.height) {
        const waste = rect.width * rect.height - option.width * option.height;
        const shortSideWaste = Math.min(rect.width - option.width, rect.height - option.height);
        const score = waste + shortSideWaste;

        if (!best || score < best.score) {
          best = {
            score,
            rect,
            rectIndex: i,
            placement: {
              x: rect.x,
              y: rect.y,
              width: option.width,
              height: option.height,
              sourceLength: piece.length,
              sourceWidth: piece.width,
              pieceNo: piece.pieceNo,
              rotated: option.rotated,
            },
          };
        }
      }
    }
  }

  return best;
}

function splitFreeRects(freeRects, rectIndex, placement) {
  const base = freeRects[rectIndex];
  const result = freeRects.filter((_, i) => i !== rectIndex);

  const right = {
    x: base.x + placement.width,
    y: base.y,
    width: base.width - placement.width,
    height: placement.height,
  };

  const bottom = {
    x: base.x,
    y: base.y + placement.height,
    width: base.width,
    height: base.height - placement.height,
  };

  for (const rect of [right, bottom]) {
    if (rect.width > 0.5 && rect.height > 0.5) {
      result.push(rect);
    }
  }

  return pruneContainedRectangles(result);
}

function pruneContainedRectangles(rects) {
  return rects.filter((a, i) => {
    for (let j = 0; j < rects.length; j += 1) {
      if (i === j) continue;
      const b = rects[j];
      const inside =
        a.x >= b.x &&
        a.y >= b.y &&
        a.x + a.width <= b.x + b.width &&
        a.y + a.height <= b.y + b.height;
      if (inside) return false;
    }
    return true;
  });
}

function renderResults(result) {
  els.results.classList.remove("hidden");
  els.resultUnit.textContent = `All dimensions in ${unitLabel()}`;
  els.summary.innerHTML = "";
  els.warnings.innerHTML = "";
  els.legend.innerHTML = "";
  els.layouts.innerHTML = "";

  renderSummary(result);
  renderWarnings(result.warnings);
  renderLegend();
  renderLayouts(result.sheets, result.summary);
}

function renderSummary(result) {
  const overview = [
    {
      number: result.totals.sheetsUsed,
      label: `total sheet${result.totals.sheetsUsed === 1 ? "" : "s"} required`,
    },
    {
      number: result.totals.piecesPlaced,
      label: `${result.totals.piecesRequired} required piece${result.totals.piecesRequired === 1 ? "" : "s"} planned`,
    },
    {
      number: result.totals.materials,
      label: `material group${result.totals.materials === 1 ? "" : "s"}`,
    },
  ];

  for (const item of overview) {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `<strong>${item.number}</strong><span>${escapeHtml(item.label)}</span>`;
    els.summary.appendChild(card);
  }

  for (const row of result.summary) {
    const card = document.createElement("div");
    card.className = "summary-card";
    const remainingText =
      row.remainingStock === null
        ? "Assumed sheets, no stock limit"
        : `${row.remainingStock} full sheet${row.remainingStock === 1 ? "" : "s"} still in stock`;
    card.innerHTML = `
      <strong>${escapeHtml(row.material)}</strong>
      <span>
        ${row.sheetsUsed} sheet${row.sheetsUsed === 1 ? "" : "s"} used from ${row.source}<br>
        ${row.placedPieces}/${row.requiredPieces} pieces placed<br>
        ${remainingText}<br>
        ${row.utilization.toFixed(1)}% sheet area used
      </span>
    `;
    els.summary.appendChild(card);
  }
}

function renderWarnings(warnings) {
  if (!warnings.length) {
    const ok = document.createElement("div");
    ok.className = "success";
    ok.textContent = "All required pieces were placed successfully.";
    els.warnings.appendChild(ok);
    return;
  }

  for (const warning of warnings) {
    const div = document.createElement("div");
    div.className = warning.includes("no stock was added") ? "success" : "warning";
    div.textContent = warning;
    els.warnings.appendChild(div);
  }
}

function renderLegend() {
  const items = [
    ["Cut pieces", "hsl(174 54% 78%)"],
    ["Reusable remaining area", "var(--remaining)"],
    ["Waste / narrow offcut", "var(--waste)"],
  ];

  for (const [label, color] of items) {
    const node = document.createElement("div");
    node.className = "legend-item";
    node.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${label}`;
    els.legend.appendChild(node);
  }
}

function renderLayouts(sheets, summary) {
  if (!sheets.length) {
    const empty = document.createElement("div");
    empty.className = "warning";
    empty.textContent = "No sheets could be drawn because none of the pieces fit the available sheet sizes.";
    els.layouts.appendChild(empty);
    return;
  }

  const byMaterial = groupBy(sheets, (sheet) => materialKey(sheet.material));
  for (const [, list] of byMaterial.entries()) {
    const material = list[0].material;
    const materialSummary = summary.find((row) => materialKey(row.material) === materialKey(material));
    const group = document.createElement("div");
    group.className = "material-group";

    const heading = document.createElement("div");
    heading.className = "material-heading";
    heading.innerHTML = `
      <h3>${escapeHtml(material)} layouts</h3>
      <p>${materialSummary ? `${materialSummary.sheetsUsed} sheet${materialSummary.sheetsUsed === 1 ? "" : "s"} required` : ""}</p>
    `;
    group.appendChild(heading);

    list.forEach((sheet, index) => group.appendChild(buildSheetNode(sheet, index + 1)));
    els.layouts.appendChild(group);
  }
}

function buildSheetNode(sheet, index) {
  const container = document.createElement("div");
  container.className = "sheet-block";

  const usedPct = ((sheet.usedArea / (sheet.length * sheet.width)) * 100).toFixed(1);
  const title = document.createElement("div");
  title.className = "sheet-title";
  title.innerHTML = `
    <div>
      <strong>${escapeHtml(sheet.material)} sheet ${index}</strong>
      <small>${sheet.source} - ${formatDim(sheet.length)} length x ${formatDim(sheet.width)} width ${unitLabel()}</small>
    </div>
    <div class="sheet-stats">
      ${sheet.placements.length} cut piece${sheet.placements.length === 1 ? "" : "s"}<br>
      ${usedPct}% used
    </div>
  `;

  const wrap = document.createElement("div");
  wrap.className = "canvas-wrap";

  const canvas = document.createElement("div");
  canvas.className = "sheet-canvas";

  const size = getCanvasSize(sheet);
  const scale = size.scale;
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;

  const widthDim = document.createElement("div");
  widthDim.className = "dimension-label dim-width";
  widthDim.textContent = `Width ${formatDim(sheet.width)} ${unitLabel()}`;
  canvas.appendChild(widthDim);

  const lengthDim = document.createElement("div");
  lengthDim.className = "dimension-label dim-length";
  lengthDim.textContent = `Length ${formatDim(sheet.length)} ${unitLabel()}`;
  canvas.appendChild(lengthDim);

  sheet.freeRects.forEach((rect) => {
    canvas.appendChild(buildFreeRectNode(rect, sheet, scale));
  });

  sheet.placements.forEach((placement, placementIndex) => {
    canvas.appendChild(buildPieceNode(placement, placementIndex, scale));
  });

  wrap.appendChild(canvas);
  container.appendChild(title);
  container.appendChild(wrap);
  return container;
}

function buildPieceNode(placement, index, scale) {
  const block = document.createElement("div");
  block.className = "piece";
  setRectStyles(block, placement, scale);
  block.style.background = colorForIndex(index);

  const readable = placement.width * scale >= 64 && placement.height * scale >= 36;
  block.innerHTML = `
    <span class="rect-label${readable ? "" : " tiny-label"}">
      Piece ${placement.pieceNo}<br>
      ${formatDim(placement.sourceLength)} x ${formatDim(placement.sourceWidth)} ${unitLabel()}
    </span>
  `;
  block.title = `Piece ${placement.pieceNo}: ${formatDim(placement.sourceLength)} x ${formatDim(placement.sourceWidth)} ${unitLabel()}${placement.rotated ? " (rotated on sheet)" : ""}`;
  return block;
}

function buildFreeRectNode(rect, sheet, scale) {
  const block = document.createElement("div");
  const isWaste = isWasteRect(rect, sheet);
  block.className = `waste-rect${isWaste ? "" : " reusable-rect"}`;
  setRectStyles(block, rect, scale);

  if (!isWaste) {
    block.style.background = "var(--remaining)";
    block.style.borderStyle = "solid";
  }

  const readable = rect.width * scale >= 72 && rect.height * scale >= 38;
  const label = isWaste ? "Waste" : "Remaining";
  block.innerHTML = `
    <span class="rect-label${readable ? "" : " tiny-label"}">
      ${label}<br>
      ${formatDim(rect.height)} x ${formatDim(rect.width)} ${unitLabel()}
    </span>
  `;
  block.title = `${label}: ${formatDim(rect.height)} length x ${formatDim(rect.width)} width ${unitLabel()}`;
  return block;
}

function setRectStyles(node, rect, scale) {
  node.style.left = `${rect.x * scale}px`;
  node.style.top = `${rect.y * scale}px`;
  node.style.width = `${Math.max(rect.width * scale, 1)}px`;
  node.style.height = `${Math.max(rect.height * scale, 1)}px`;
}

function getCanvasSize(sheet) {
  const maxWidth = Math.min(760, Math.max(280, window.innerWidth - 76));
  const maxHeight = 620;
  const scale = Math.min(maxWidth / sheet.width, maxHeight / sheet.length);

  return {
    scale,
    width: Math.max(180, sheet.width * scale),
    height: Math.max(300, sheet.length * scale),
  };
}

function isWasteRect(rect, sheet) {
  const area = rect.width * rect.height;
  const sheetArea = sheet.width * sheet.length;
  const narrowLimit = 3 * 25.4;
  return Math.min(rect.width, rect.height) < narrowLimit || area / sheetArea < 0.035;
}

function buildUnplacedWarnings(materialName, unplaced, usesAssumedSheet) {
  const warnings = [];
  const grouped = groupBy(unplaced, (piece) => `${piece.length}x${piece.width}`);
  const reason = usesAssumedSheet ? "larger than the assumed sheet" : "too large for the stock sheet or stock quantity is not enough";

  for (const [dim, list] of grouped.entries()) {
    const [length, width] = dim.split("x").map(Number);
    warnings.push(
      `${materialName}: ${list.length} piece${list.length === 1 ? "" : "s"} of ${formatDim(length)} x ${formatDim(width)} ${unitLabel()} could not be placed because it is ${reason}.`
    );
  }

  return warnings;
}

function expandPieces(items) {
  const all = [];
  for (const item of items) {
    for (let i = 0; i < item.qty; i += 1) {
      all.push({ length: item.length, width: item.width });
    }
  }
  return all;
}

function sortPieces(a, b) {
  const areaDiff = b.length * b.width - a.length * a.width;
  if (areaDiff !== 0) return areaDiff;
  return Math.max(b.length, b.width) - Math.max(a.length, a.width);
}

function colorForIndex(index) {
  const palette = [
    "hsl(174 54% 78%)",
    "hsl(43 88% 76%)",
    "hsl(204 78% 82%)",
    "hsl(12 82% 82%)",
    "hsl(138 52% 78%)",
    "hsl(286 52% 84%)",
    "hsl(55 72% 78%)",
    "hsl(350 70% 84%)",
  ];
  return palette[index % palette.length];
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function removeById(items, id) {
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) items.splice(index, 1);
}

function parsePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parseWholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function toMm(value) {
  return value * unitConfig[currentUnit].toMm;
}

function fromMm(value) {
  return value / unitConfig[currentUnit].toMm;
}

function formatDim(mmValue) {
  const converted = fromMm(mmValue);
  const precision = unitConfig[currentUnit].precision;
  return converted.toFixed(precision).replace(/\.?0+$/, "");
}

function unitLabel() {
  return unitConfig[currentUnit].label;
}

function materialKey(value) {
  return cleanText(value).toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function clearStockInputs() {
  els.stockMaterial.value = "";
  els.stockLength.value = "";
  els.stockWidth.value = "";
  els.stockCount.value = "";
}

function clearPieceInputs() {
  els.pieceMaterial.value = "";
  els.pieceLength.value = "";
  els.pieceWidth.value = "";
  els.pieceQty.value = "";
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
