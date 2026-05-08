const stockItems = [];
const pieceItems = [];
const unitConfig = {
  mm: { label: "mm", toMm: 1 },
  cm: { label: "cm", toMm: 10 },
  in: { label: "in", toMm: 25.4 },
  ft: { label: "ft", toMm: 304.8 },
};
let currentUnit = "mm";

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
  summary: document.getElementById("summary"),
  warnings: document.getElementById("warnings"),
  layouts: document.getElementById("layouts"),
};

els.addStock.addEventListener("click", onAddStock);
els.addPiece.addEventListener("click", onAddPiece);
els.calculate.addEventListener("click", onCalculate);
els.loadDemo.addEventListener("click", onLoadDemo);
els.clearAll.addEventListener("click", onClearAll);
els.unitSelect.addEventListener("change", onUnitChange);

function onUnitChange() {
  currentUnit = els.unitSelect.value;
  renderStockTable();
  renderPieceTable();
}

function onAddStock() {
  const material = cleanText(els.stockMaterial.value);
  const length = toMm(parsePositive(els.stockLength.value));
  const width = toMm(parsePositive(els.stockWidth.value));
  const available = parsePositive(els.stockCount.value);

  if (!material || !length || !width || !available) {
    alert("Please fill all stock fields with valid values.");
    return;
  }

  stockItems.push({
    id: crypto.randomUUID(),
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
  const qty = parsePositive(els.pieceQty.value);

  if (!material || !length || !width || !qty) {
    alert("Please fill all piece fields with valid values.");
    return;
  }

  pieceItems.push({
    id: crypto.randomUUID(),
    material,
    length,
    width,
    qty,
  });

  clearPieceInputs();
  renderPieceTable();
}

function onCalculate() {
  if (!stockItems.length || !pieceItems.length) {
    alert("Please add both stock sheets and required pieces first.");
    return;
  }

  const result = planCutting(stockItems, pieceItems);
  renderResults(result);
}

function onLoadDemo() {
  stockItems.length = 0;
  pieceItems.length = 0;

  stockItems.push(
    { id: crypto.randomUUID(), material: "MDF", length: 2440, width: 1220, available: 12 },
    { id: crypto.randomUUID(), material: "Laminate", length: 2440, width: 1220, available: 8 }
  );

  pieceItems.push(
    { id: crypto.randomUUID(), material: "MDF", length: 2100, width: 550, qty: 2 },
    { id: crypto.randomUUID(), material: "MDF", length: 2100, width: 500, qty: 2 },
    { id: crypto.randomUUID(), material: "MDF", length: 800, width: 500, qty: 6 },
    { id: crypto.randomUUID(), material: "MDF", length: 700, width: 450, qty: 5 },
    { id: crypto.randomUUID(), material: "Laminate", length: 2100, width: 550, qty: 2 },
    { id: crypto.randomUUID(), material: "Laminate", length: 800, width: 500, qty: 6 }
  );

  renderStockTable();
  renderPieceTable();
}

function onClearAll() {
  stockItems.length = 0;
  pieceItems.length = 0;
  renderStockTable();
  renderPieceTable();
  els.results.classList.add("hidden");
  els.summary.innerHTML = "";
  els.warnings.innerHTML = "";
  els.layouts.innerHTML = "";
}

function renderStockTable() {
  els.stockBody.innerHTML = "";
  for (const item of stockItems) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.material)}</td>
      <td>${formatDim(item.length)} x ${formatDim(item.width)} ${unitLabel()}</td>
      <td>${item.available}</td>
      <td><button class="btn" data-remove-stock="${item.id}">Remove</button></td>
    `;
    els.stockBody.appendChild(tr);
  }

  els.stockBody.querySelectorAll("[data-remove-stock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-stock");
      const idx = stockItems.findIndex((s) => s.id === id);
      if (idx >= 0) {
        stockItems.splice(idx, 1);
        renderStockTable();
      }
    });
  });
}

function renderPieceTable() {
  els.pieceBody.innerHTML = "";
  for (const item of pieceItems) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.material)}</td>
      <td>${formatDim(item.length)} x ${formatDim(item.width)} ${unitLabel()}</td>
      <td>${item.qty}</td>
      <td><button class="btn" data-remove-piece="${item.id}">Remove</button></td>
    `;
    els.pieceBody.appendChild(tr);
  }

  els.pieceBody.querySelectorAll("[data-remove-piece]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-piece");
      const idx = pieceItems.findIndex((s) => s.id === id);
      if (idx >= 0) {
        pieceItems.splice(idx, 1);
        renderPieceTable();
      }
    });
  });
}

function planCutting(stocks, pieces) {
  const materialGroups = groupBy(pieces, (p) => p.material.toLowerCase());
  const allSheets = [];
  const summaryByMaterial = {};
  const warnings = [];

  for (const [materialKey, matPieces] of materialGroups.entries()) {
    const materialName = matPieces[0].material;
    const stocksForMaterial = stocks
      .filter((s) => s.material.toLowerCase() === materialKey)
      .map((s) => ({ ...s, used: 0 }))
      .sort((a, b) => b.length * b.width - a.length * a.width);

    if (!stocksForMaterial.length) {
      warnings.push(`No stock sheet found for material: ${materialName}`);
      continue;
    }

    const requiredUnits = expandPieces(matPieces).sort(sortPieces);
    const activeSheets = [];
    const unplaced = [];

    for (const unit of requiredUnits) {
      const placedInExisting = placeInBestSheet(activeSheets, unit);
      if (placedInExisting) continue;

      const opened = openBestSheetAndPlace(stocksForMaterial, activeSheets, unit);
      if (!opened) {
        unplaced.push(unit);
      }
    }

    const used = activeSheets.length;
    summaryByMaterial[materialName] = {
      requiredPieces: requiredUnits.length,
      placedPieces: requiredUnits.length - unplaced.length,
      usedSheets: used,
      unusedStock: stocksForMaterial.reduce((acc, s) => acc + (s.available - s.used), 0),
    };

    allSheets.push(...activeSheets);

    if (unplaced.length) {
      const grouped = groupBy(unplaced, (u) => `${u.length}x${u.width}`);
      for (const [dim, list] of grouped.entries()) {
        const [l, w] = dim.split("x").map((v) => Number(v));
        warnings.push(
          `Material ${materialName}: could not place ${list.length} piece(s) of ${formatDim(l)} x ${formatDim(w)} ${unitLabel()} because available stock is not enough.`
        );
      }
    }
  }

  const totalUsed = allSheets.length;
  return { summaryByMaterial, allSheets, warnings, totalUsed };
}

function openBestSheetAndPlace(stocksForMaterial, activeSheets, piece) {
  let selected = null;

  for (const stock of stocksForMaterial) {
    if (stock.used >= stock.available) continue;

    const preview = tryPlaceOnFreshSheet(stock, piece);
    if (!preview) continue;

    if (!selected || preview.remainingWaste < selected.preview.remainingWaste) {
      selected = { stock, preview };
    }
  }

  if (!selected) return false;

  selected.stock.used += 1;
  const sheetId = `${selected.stock.material}-${selected.stock.length}x${selected.stock.width}-${selected.stock.used}`;
  const sheet = {
    id: sheetId,
    material: selected.stock.material,
    length: selected.stock.length,
    width: selected.stock.width,
    placements: [selected.preview.placement],
    freeRects: selected.preview.freeRects,
    usedArea: selected.preview.placement.width * selected.preview.placement.height,
  };

  activeSheets.push(sheet);
  return true;
}

function tryPlaceOnFreshSheet(stock, piece) {
  const freeRects = [{ x: 0, y: 0, width: stock.length, height: stock.width }];
  const fit = choosePlacement(freeRects, piece);
  if (!fit) return null;

  const updated = splitFreeRects(freeRects, fit.rectIndex, fit.placement);
  const totalArea = stock.length * stock.width;
  const usedArea = fit.placement.width * fit.placement.height;
  return {
    placement: fit.placement,
    freeRects: updated,
    remainingWaste: totalArea - usedArea,
  };
}

function placeInBestSheet(activeSheets, piece) {
  let best = null;

  for (let i = 0; i < activeSheets.length; i += 1) {
    const sheet = activeSheets[i];
    const fit = choosePlacement(sheet.freeRects, piece);
    if (!fit) continue;

    const leftoverScore = fit.rect.width * fit.rect.height - fit.placement.width * fit.placement.height;

    if (!best || leftoverScore < best.leftoverScore) {
      best = { sheetIndex: i, fit, leftoverScore };
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
      { width: piece.length, height: piece.width, rotated: false },
      { width: piece.width, height: piece.length, rotated: true },
    ];

    for (const option of options) {
      if (option.width <= rect.width && option.height <= rect.height) {
        const waste = rect.width * rect.height - option.width * option.height;
        if (!best || waste < best.waste) {
          best = {
            waste,
            rect,
            rectIndex: i,
            placement: {
              x: rect.x,
              y: rect.y,
              width: option.width,
              height: option.height,
              sourceLength: piece.length,
              sourceWidth: piece.width,
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

  const remainder = {
    x: base.x + placement.width,
    y: base.y + placement.height,
    width: base.width - placement.width,
    height: base.height - placement.height,
  };

  [right, bottom, remainder]
    .filter((r) => r.width > 0 && r.height > 0)
    .forEach((r) => result.push(r));

  return pruneContainedRectangles(result);
}

function pruneContainedRectangles(rects) {
  return rects.filter((a, i) => {
    for (let j = 0; j < rects.length; j += 1) {
      if (i === j) continue;
      const b = rects[j];
      if (a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height) {
        return false;
      }
    }
    return true;
  });
}

function renderResults(result) {
  els.results.classList.remove("hidden");
  els.summary.innerHTML = "";
  els.warnings.innerHTML = "";
  els.layouts.innerHTML = "";

  const totalCard = document.createElement("div");
  totalCard.className = "summary-card";
  totalCard.innerHTML = `<strong>Total Sheets Used:</strong> <span class="ok">${result.totalUsed}</span><br />Current display unit: ${unitLabel()}`;
  els.summary.appendChild(totalCard);

  Object.entries(result.summaryByMaterial).forEach(([material, row]) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <strong>${escapeHtml(material)}</strong><br />
      Required Pieces: ${row.requiredPieces} | Placed: ${row.placedPieces}<br />
      Sheets Used: ${row.usedSheets} | Remaining Stock: ${row.unusedStock}
    `;
    els.summary.appendChild(card);
  });

  if (!result.warnings.length) {
    const ok = document.createElement("div");
    ok.className = "summary-card";
    ok.innerHTML = "All pieces were placed successfully.";
    els.warnings.appendChild(ok);
  } else {
    result.warnings.forEach((w) => {
      const div = document.createElement("div");
      div.className = "warning";
      div.textContent = w;
      els.warnings.appendChild(div);
    });
  }

  const byMaterial = groupBy(result.allSheets, (s) => s.material.toLowerCase());

  for (const [_, list] of byMaterial.entries()) {
    const materialName = list[0].material;
    const title = document.createElement("h3");
    title.textContent = `${materialName} Layouts`;
    els.layouts.appendChild(title);

    list.forEach((sheet, idx) => {
      els.layouts.appendChild(buildSheetNode(sheet, idx + 1));
    });
  }
}

function buildSheetNode(sheet, index) {
  const container = document.createElement("div");
  container.className = "sheet-block";

  const usedPct = ((sheet.usedArea / (sheet.length * sheet.width)) * 100).toFixed(1);
  const title = document.createElement("div");
  title.className = "sheet-title";
  title.innerHTML = `
    <div><strong>Sheet ${index}</strong> - ${formatDim(sheet.length)} x ${formatDim(sheet.width)} ${unitLabel()}</div>
    <div>Utilization: ${usedPct}% | Pieces: ${sheet.placements.length}</div>
  `;

  const wrap = document.createElement("div");
  wrap.className = "canvas-wrap";

  const maxPx = 620;
  const scale = Math.min(maxPx / sheet.length, 340 / sheet.width, 1);

  const canvas = document.createElement("div");
  canvas.className = "sheet-canvas";
  canvas.style.width = `${Math.max(220, sheet.length * scale)}px`;
  canvas.style.height = `${Math.max(140, sheet.width * scale)}px`;

  sheet.placements.forEach((p, i) => {
    const block = document.createElement("div");
    block.className = "piece";
    block.style.left = `${p.x * scale}px`;
    block.style.top = `${p.y * scale}px`;
    block.style.width = `${p.width * scale}px`;
    block.style.height = `${p.height * scale}px`;
    block.style.background = colorForIndex(i);
    block.title = `${formatDim(p.sourceLength)} x ${formatDim(p.sourceWidth)} ${unitLabel()}${p.rotated ? " (rotated)" : ""}`;
    block.textContent = `${formatDim(p.sourceLength)}x${formatDim(p.sourceWidth)}`;
    canvas.appendChild(block);
  });

  wrap.appendChild(canvas);
  container.appendChild(title);
  container.appendChild(wrap);
  return container;
}

function colorForIndex(index) {
  const hue = (index * 47) % 360;
  return `hsl(${hue} 70% 85%)`;
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
  const maxSideA = Math.max(a.length, a.width);
  const maxSideB = Math.max(b.length, b.width);
  return maxSideB - maxSideA;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    const list = m.get(key) || [];
    list.push(item);
    m.set(key, list);
  }
  return m;
}

function parsePositive(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toMm(value) {
  return value * unitConfig[currentUnit].toMm;
}

function fromMm(value) {
  return value / unitConfig[currentUnit].toMm;
}

function formatDim(mmValue) {
  const converted = fromMm(mmValue);
  if (Number.isInteger(converted)) return String(converted);
  return converted.toFixed(2).replace(/\.00$/, "");
}

function unitLabel() {
  return unitConfig[currentUnit].label;
}

function cleanText(v) {
  return String(v || "").trim();
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

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
