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
let packingStrategy = 0;
let kerfMm = 3;

const els = {
  stockMaterial: document.getElementById("stock-material"),
  stockLength: document.getElementById("stock-length"),
  stockWidth: document.getElementById("stock-width"),
  stockCount: document.getElementById("stock-count"),
  pieceMaterial: document.getElementById("piece-material"),
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
renderUnitMenu();
els.addStock.addEventListener("click", onAddStock);
els.addPiece.addEventListener("click", onAddPiece);
els.calculate.addEventListener("click", onCalculate);
els.loadDemo.addEventListener("click", onLoadDemo);
els.clearAll.addEventListener("click", onClearAll);
els.unitSelect.addEventListener("change", onUnitChange);

document.getElementById("stock-material-picker").addEventListener("change", (event) => {
  els.pieceMaterial.value = event.target.value;
  els.pieceMaterial.hidden = !!event.target.value;
  renderPiecePreview();
});
for (const id of ["estimate-length", "estimate-width", "kerf"]) document.getElementById(id).addEventListener("input", invalidateResult);
renderStockTable();
renderPieceTable();
for (const id of ["piece-length-feet", "piece-length-inches", "piece-length-sootar", "piece-width-feet", "piece-width-inches", "piece-width-sootar", "piece-direction", "piece-material", "estimate-length", "estimate-width"]) {
  document.getElementById(id).addEventListener("input", renderPiecePreview);
  document.getElementById(id).addEventListener("change", renderPiecePreview);
}
renderPiecePreview();

document.addEventListener("click", event => {
  const menu = document.getElementById("material-menu");
  if (!menu.contains(event.target)) menu.open = false;
});
document.getElementById("material-menu").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary").focus();
  }
});

document.addEventListener("click", event => {
  const menu = document.getElementById("unit-menu");
  if (!menu.contains(event.target)) menu.open = false;
});
document.getElementById("unit-menu").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary").focus();
  }
});

function onUnitChange() {
  const savedResult = lastResult;
  const oldUnit = currentUnit;
  currentUnit = els.unitSelect.value;
  renderUnitMenu();
  for (const id of ["stock-length", "stock-width", "estimate-length", "estimate-width"]) {
    const input = document.getElementById(id);
    if (input.value) input.value = Number((Number(input.value) * unitConfig[oldUnit].toMm / unitConfig[currentUnit].toMm).toFixed(6));
  }
  renderStockTable();
  renderPieceTable();

  if (savedResult) {
    lastResult = savedResult;
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
  const length = readPieceDimension("length");
  const width = readPieceDimension("width");
  const qty = parseWholeNumber(els.pieceQty.value);

  if (!material || !Number.isFinite(length) || length <= 0 || !Number.isFinite(width) || width <= 0 || !qty) {
    alert("Please fill all piece fields with valid positive values.");
    return;
  }

  pieceItems.push({
    id: makeId(),
    material,
    length,
    width,
    qty,
    direction: document.getElementById("piece-direction").value,
  });

  clearPieceInputs();
  renderPieceTable();
}

function onCalculate() {
  if (!pieceItems.length) {
    alert("Please add required pieces first.");
    return;
  }

  const length = toMm(parsePositive(document.getElementById("estimate-length").value));
  const width = toMm(parsePositive(document.getElementById("estimate-width").value));
  kerfMm = Number(document.getElementById("kerf").value);
  if (!length || !width || !Number.isFinite(kerfMm) || kerfMm < 0) return alert("Enter positive estimate dimensions and a non-negative kerf.");
  if (pieceItems.reduce((sum, p) => sum + p.qty, 0) > 2000) return alert("Please plan at most 2,000 pieces at a time.");
  DEFAULT_SHEET.length = length; DEFAULT_SHEET.width = width;
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

function invalidateResult() {
  lastResult = null;
  els.results.classList.add("hidden");
}
function renderStockTable() {
  invalidateResult();
  const picker = document.getElementById("stock-material-picker");
  const previous = picker.value;
  const names = [...new Map(stockItems.map(s => [materialKey(s.material), s.material])).values()];
  picker.innerHTML = '<option value="">New material / estimate</option>' + names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  picker.value = names.includes(previous) ? previous : (names[0] || "");
  els.pieceMaterial.hidden = !!picker.value;
  if (picker.value) els.pieceMaterial.value = picker.value;
  renderMaterialMenu();
  renderPiecePreview();
  els.stockBody.innerHTML = "";

  if (!stockItems.length) {
    els.stockBody.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">No stock added. Enter pieces and configure the estimate sheet size below.</td>
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
  invalidateResult();
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
      <td>${formatDim(item.length)} x ${formatDim(item.width)} ${unitLabel()}<br><small>${item.direction === "horizontal" ? "↔ Horizontal" : "↕ Vertical"}</small></td>
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
  const combined = { summary: [], sheets: [], warnings: [], totals: {materials: 0, sheetsUsed: 0, piecesRequired: 0, piecesPlaced: 0} };
  for (const group of groupBy(pieces, p => materialKey(p.material)).values()) {
    let best;
    const quantity = group.reduce((sum, piece) => sum + piece.qty, 0);
    const passes = quantity <= 100 ? 120 : 36;
    for (packingStrategy = 0; packingStrategy < passes; packingStrategy++) {
      const candidate = planPass(stocks, group);
      const score = [candidate.totals.piecesRequired - candidate.totals.piecesPlaced, candidate.totals.sheetsUsed, candidate.sheets.reduce((a, s) => a + s.length * s.width, 0), -offcutValue(candidate.sheets), -reusableArea(candidate.sheets), -remnantUtility(candidate.sheets), candidate.sheets.reduce((sum, sheet) => sum + sheet.freeRects.length, 0)];
      if (!best || score.some((v, i) => v < best.score[i] && score.slice(0, i).every((x, j) => x === best.score[j]))) best = {result: candidate, score};
    }
    for (const key of ["summary", "sheets", "warnings"]) combined[key].push(...best.result[key]);
    for (const key in combined.totals) combined.totals[key] += best.result.totals[key];
  }
  return combined;
}
function planPass(stocks, pieces) {
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
      .map((piece, i) => ({...piece, pieceNo: i + 1}))
      .sort((a, b) => {
        const order = Math.floor(packingStrategy / 6);
        const metric = p => {
          const dimensions = [p.length * p.width, p.direction === "horizontal" ? p.length : p.width, p.direction === "horizontal" ? p.width : p.length, Math.max(p.length, p.width), Math.min(p.length, p.width), p.length + p.width];
          if (order < 6) return dimensions[order];
          // Deterministic alternative orders explore layouts beyond largest-first.
          let hash = Math.imul(p.pieceNo + 1, 374761393) ^ Math.imul(order + 1, 668265263);
          hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
          return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
        };
        return metric(b) - metric(a) || sortPieces(a, b);
      })
      .map((piece, index) => ({ ...piece, material: materialName, pieceNo: piece.pieceNo }));

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
    const options = piece.direction === "horizontal"
      ? [{width: piece.length, height: piece.width, rotated: true}]
      : [{width: piece.width, height: piece.length, rotated: false}];

    for (const option of options) {
      if (option.width <= rect.width + 1e-7 && option.height <= rect.height + 1e-7) {
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

  const dx = Math.min(base.width, placement.width + kerfMm);
  const dy = Math.min(base.height, placement.height + kerfMm);
  const splitMode = packingStrategy % 6;
  // Mixed cut passes preserve a continuous side strip below a wider first piece.
  let verticalSplit = splitMode === 1 || (splitMode === 2 && base.y > 1e-7) || (splitMode === 3 && base.y < 1e-7);
  if (splitMode >= 4) {
    const utility = (w, h) => {
      const area = Math.max(0, w) * Math.max(0, h);
      return splitMode === 4 ? area * area : area * Math.min(w, h);
    };
    const vertical = utility(base.width - dx, base.height) + utility(placement.width, base.height - dy);
    const horizontal = utility(base.width - dx, placement.height) + utility(base.width, base.height - dy);
    verticalSplit = vertical > horizontal;
  }
  const right = {x: base.x + dx, y: base.y, width: base.width - dx, height: verticalSplit ? base.height : placement.height};
  const bottom = {x: base.x, y: base.y + dy, width: verticalSplit ? placement.width : base.width, height: base.height - dy};
  for (const rect of [right, bottom]) if (rect.width > 1e-7 && rect.height > 1e-7) result.push(rect);

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
      label: `sheet${result.totals.sheetsUsed === 1 ? "" : "s"} in this plan`,
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
    ["↕ Vertical / ↔ Horizontal pieces", "#c8ae8b"],
    ["Potentially reusable offcut", "var(--remaining)"],
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
      ${usedPct}% used<br>${(100 - Number(usedPct)).toFixed(1)}% offcut / kerf
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
  const details = document.createElement("details");
  details.className = "cut-list";
  details.innerHTML = `<summary>Cut list & offcuts · ${sheet.placements.length} pieces</summary><ul>${sheet.placements.map(p => `<li><b>P${p.pieceNo} ${p.rotated ? "↔" : "↕"}</b> ${formatDim(p.sourceLength)} × ${formatDim(p.sourceWidth)} ${unitLabel()} · ${p.rotated ? "Horizontal" : "Vertical"}</li>`).join("")}${sheet.freeRects.map(r => `<li>Offcut: ${formatDim(r.height)} × ${formatDim(r.width)} ${unitLabel()}</li>`).join("")}</ul>`;
  container.appendChild(details);
  return container;
}

function buildPieceNode(placement, index, scale) {
  const block = document.createElement("div");
  block.className = "piece";
  setRectStyles(block, placement, scale);
  block.classList.add(placement.rotated ? "horizontal-pattern" : "vertical-pattern");
  block.style.setProperty("--piece-color", colorForIndex(placement.pieceNo));
  const texture = document.createElement("div");
  texture.className = "piece-texture";
  // Use one physical texture scale for all pieces, independent of their aspect ratio.
  // CSS auto height preserves the original 1000:1713 image ratio; excess is cropped.
  texture.style.backgroundSize = `${4 * MM_PER_FOOT * scale}px auto`;
  const w = placement.width * scale, h = placement.height * scale;
  texture.style.width = `${placement.rotated ? h : w}px`;
  texture.style.height = `${placement.rotated ? w : h}px`;
  if (placement.rotated) texture.style.transform = "translate(-50%, -50%) rotate(90deg)";

  const readable = placement.width * scale >= 42 && placement.height * scale >= 36;
  block.innerHTML = `
    <span class="rect-label${readable ? "" : " tiny-label"}">
      P${placement.pieceNo} ${placement.rotated ? "↔" : "↕"}<br>
      ${formatDim(placement.sourceLength)} x ${formatDim(placement.sourceWidth)} ${unitLabel()}
    </span>
  `;
  block.prepend(texture);
  if (!readable) block.querySelector("span").textContent = `P${placement.pieceNo}`;
  block.title = `Piece ${placement.pieceNo}: ${formatDim(placement.sourceLength)} x ${formatDim(placement.sourceWidth)} ${unitLabel()}${placement.rotated ? " — Horizontal" : " — Vertical"}`;
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
  const maxWidth = Math.min(230, Math.max(120, window.innerWidth - 150));
  const maxHeight = 300;
  const scale = Math.min(maxWidth / sheet.width, maxHeight / sheet.length);

  return {
    scale,
    width: sheet.width * scale,
    height: sheet.length * scale,
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
  const reason = usesAssumedSheet ? "unable to fit the estimate sheet in its required direction" : "unable to fit in its required direction or stock quantity is not enough";

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
      all.push({ length: item.length, width: item.width, direction: item.direction || "vertical" });
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
  return String(Number(converted.toFixed(precision)));
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
  els.stockLength.value = Number((8 * MM_PER_FOOT / unitConfig[currentUnit].toMm).toFixed(6));
  els.stockWidth.value = Number((4 * MM_PER_FOOT / unitConfig[currentUnit].toMm).toFixed(6));
  els.stockCount.value = "";
}

function clearPieceInputs() {
  if (!document.getElementById("stock-material-picker").value) els.pieceMaterial.value = "";
  for (const dimension of ["length", "width"]) {
    for (const part of ["feet", "inches", "sootar"]) document.getElementById(`piece-${dimension}-${part}`).value = "";
  }
  els.pieceQty.value = "";
  renderPiecePreview();
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

function renderMaterialMenu() {
  const picker = document.getElementById("stock-material-picker");
  const menu = document.getElementById("material-menu");
  document.getElementById("material-selection").textContent = picker.selectedOptions[0].textContent;
  const options = document.getElementById("material-options");
  options.replaceChildren();
  for (const option of picker.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.textContent;
    button.setAttribute("aria-label", option.textContent);
    button.setAttribute("aria-pressed", String(option.selected));
    button.addEventListener("click", () => {
      picker.value = option.value;
      picker.dispatchEvent(new Event("change"));
      renderMaterialMenu();
      menu.open = false;
      menu.querySelector("summary").focus();
    });
    options.appendChild(button);
  }
}

function renderUnitMenu() {
  const picker = els.unitSelect;
  const menu = document.getElementById("unit-menu");
  document.getElementById("unit-selection").textContent = picker.selectedOptions[0].textContent;
  const options = document.getElementById("unit-options");
  options.replaceChildren();
  for (const option of picker.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.textContent;
    button.setAttribute("aria-label", option.textContent);
    button.setAttribute("aria-pressed", String(option.selected));
    button.addEventListener("click", () => {
      picker.value = option.value;
      picker.dispatchEvent(new Event("change"));
      menu.open = false;
      menu.querySelector("summary").focus();
    });
    options.appendChild(button);
  }
}

function remnantUtility(sheets) {
  return sheets.reduce((total, sheet) => total + sheet.freeRects.reduce((sum, rect) => {
    const area = rect.width * rect.height;
    // Concentrate unused area into substantial rectangles, discounting narrow strips.
    // A useful width is relative to this sheet, with a three-inch minimum.
    const usefulWidth = Math.max(3 * 25.4, Math.min(sheet.width, sheet.length) * 0.1);
    const widthWeight = Math.min(1, Math.min(rect.width, rect.height) / usefulWidth);
    return sum + area * area * widthWeight * widthWeight;
  }, 0), 0);
}

function reusableArea(sheets) {
  return sheets.reduce((total, sheet) => total + sheet.freeRects.reduce((sum, rect) =>
    sum + (isWasteRect(rect, sheet) ? 0 : rect.width * rect.height), 0), 0);
}

function offcutValue(sheets) {
  // Balance recoverable area with concentration: a single substantial remnant
  // is more valuable than the same area split into many small rectangles.
  const remaining = sheets.reduce((sum, sheet) => sum + sheet.freeRects.reduce((area, rect) => area + rect.width * rect.height, 0), 0);
  return reusableArea(sheets) + (remaining ? 8 * remnantUtility(sheets) / remaining : 0);
}

function renderPiecePreview() {
  const horizontal = document.getElementById("piece-direction").value === "horizontal";
  const length = readPieceDimension("length");
  const width = readPieceDimension("width");
  const complete = Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0;
  const across = horizontal ? length : width;
  const down = horizontal ? width : length;
  const matching = stockItems.filter(s => materialKey(s.material) === materialKey(els.pieceMaterial.value));
  const sheet = matching.find(s => across <= s.width && down <= s.length) || matching[0] || {
    length: toMm(parsePositive(document.getElementById("estimate-length").value)),
    width: toMm(parsePositive(document.getElementById("estimate-width").value))
  };
  const validSheet = sheet.length > 0 && sheet.width > 0;
  const fits = validSheet && across <= sheet.width && down <= sheet.length;
  const demoLength = (Number.isFinite(length) && length > 0 ? length : 0) || (validSheet ? sheet.length * .45 : 3 * MM_PER_FOOT);
  const demoWidth = (Number.isFinite(width) && width > 0 ? width : 0) || (validSheet ? sheet.width * .55 : 1.5 * MM_PER_FOOT);
  const pw = horizontal ? demoLength : demoWidth;
  const ph = horizontal ? demoWidth : demoLength;
  const sw = validSheet ? sheet.width : 4 * MM_PER_FOOT;
  const sh = validSheet ? sheet.length : 8 * MM_PER_FOOT;
  const scale = Math.min(210 / Math.max(sw, pw), 175 / Math.max(sh, ph));
  const x = 72, y = 40, w = pw * scale, h = ph * scale;
  const topName = horizontal ? "Length" : "Width";
  const sideName = horizontal ? "Width" : "Length";
  const topColor = horizontal ? "#0f766e" : "#a36113";
  const sideColor = horizontal ? "#a36113" : "#0f766e";
  const lengthLabel = Number.isFinite(length) && length > 0 ? `${formatDim(length)} ${unitLabel()}` : "enter length";
  const widthLabel = Number.isFinite(width) && width > 0 ? `${formatDim(width)} ${unitLabel()}` : "enter width";
  const topLabel = `${topName}: ${horizontal ? lengthLabel : widthLabel}`;
  const sideLabel = `${sideName}: ${horizontal ? widthLabel : lengthLabel}`;
  document.getElementById("piece-preview-diagram").innerHTML = `<svg viewBox="0 0 360 245" role="img" aria-label="${escapeHtml(topLabel + ' across; ' + sideLabel + ' down')}">
    <rect x="${x}" y="${y}" width="${sw*scale}" height="${sh*scale}" fill="#edf1e7" stroke="#9ba88e" stroke-width="1.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${complete && !fits ? '#fce4df' : '#cce3db'}" stroke="${complete && !fits ? '#a83232' : '#0f766e'}" stroke-width="2" ${complete ? '' : 'stroke-dasharray="5 4"'}/>
    <text x="${x+w/2}" y="${y+h/2+5}" text-anchor="middle" fill="#25473e" font-size="18">${horizontal ? '↔' : '↕'}</text>
    <path d="M ${x} 33 V 24 H ${x+w} V 33" fill="none" stroke="${topColor}" stroke-width="2"/>
    <text x="${x+w/2}" y="16" text-anchor="middle" fill="${topColor}" font-size="12" font-weight="700">${topLabel}</text>
    <path d="M 65 ${y} H 56 V ${y+h} H 65" fill="none" stroke="${sideColor}" stroke-width="2"/>
    <text x="24" y="${y+h/2}" transform="rotate(-90 24 ${y+h/2})" text-anchor="middle" fill="${sideColor}" font-size="12" font-weight="700">${sideLabel}</text>
    <text x="${x}" y="235" fill="#637083" font-size="11">Sheet: ${formatDim(sh)} length × ${formatDim(sw)} width ${unitLabel()} · grain ↕</text>
  </svg>`;
  const description = document.getElementById("piece-preview-description");
  description.textContent = horizontal
    ? `Horizontal: your length (${lengthLabel}) runs left to right; your width (${widthLabel}) runs top to bottom.`
    : `Vertical: your length (${lengthLabel}) runs top to bottom; your width (${widthLabel}) runs left to right.`;
  document.getElementById("piece-preview-sheet").textContent = !complete
    ? "Enter both dimensions to see the exact size. Dashed outline is an example."
    : !validSheet ? "Enter valid estimate sheet dimensions to check the fit."
    : !fits ? "This piece does not fit the selected material’s sheet sizes in this direction. Change dimensions or direction."
    : matching.length ? `Fits matching stock. Preview uses ${formatDim(sh)} × ${formatDim(sw)} ${unitLabel()}${matching.length > 1 ? '; other stock sizes may also be used in the final plan' : ''}.`
    : "Fits the estimate sheet. This previews one piece; the final plan also allows for saw kerf.";
}

function readPieceDimension(dimension) {
  const values = ["feet", "inches", "sootar"].map(part => {
    const input = document.getElementById(`piece-${dimension}-${part}`);
    if (input.validity && input.validity.badInput) return NaN;
    const value = input.value.trim() === "" ? 0 : Number(input.value);
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  });
  return values[0] * MM_PER_FOOT + values[1] * 25.4 + values[2] * (25.4 / 8);
}
