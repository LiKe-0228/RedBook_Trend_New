/* global chrome */

const STORAGE_KEY = "xhsNoteRankRows";

/**
 * 从“市场行情-笔记排行”页面抽取当前页数据。
 * - 账号昵称、发布时间都在“笔记”这一列内部结构里；
 * - 数值列通过表头上的中文关键词来定位；
 * - 按约定跳过每页第一行（你的自营账号）。
 */
function collectNoteRankFromDom() {
  const root =
    document.querySelector(".note-rank") ||
    document.querySelector("[data-v-7d4260ee] .note-rank") ||
    document.body;

  if (!root) {
    return { ok: false, error: "未找到 note-rank 容器。" };
  }

  const table =
    root.querySelector("table") ||
    root.querySelector(".d-table table") ||
    root.querySelector("tbody")?.closest("table");

  if (!table) {
    return {
      ok: false,
      error: "未找到表格，请确认已切换到“笔记排行”页面。"
    };
  }

  const headerCells = Array.from(
    table.querySelectorAll("thead tr th, thead tr td")
  );

  if (headerCells.length === 0) {
    return { ok: false, error: "未找到表头，请确认页面已完全加载。" };
  }

  const normalize = (text) =>
    (text || "")
      .replace(/\s+/g, "")
      .replace(/\uFFFD/g, "")
      .trim();

  const columnIndex = {
    noteInfo: -1,
    readCount: -1,
    clickRate: -1,
    payConversionRate: -1,
    gmv: -1
  };

  headerCells.forEach((cell, index) => {
    const text = normalize(cell.textContent);
    if (!text) return;

    if (
      text.includes("笔记") &&
      !text.includes("阅读") &&
      !text.includes("商品") &&
      !text.includes("支付") &&
      !text.includes("成交")
    ) {
      columnIndex.noteInfo = index;
    } else if (text.includes("阅读")) {
      columnIndex.readCount = index;
    } else if (text.includes("商品") && text.includes("点击")) {
      columnIndex.clickRate = index;
    } else if (text.includes("支付") && text.includes("转化")) {
      columnIndex.payConversionRate = index;
    } else if (text.includes("成交") && text.includes("金额")) {
      columnIndex.gmv = index;
    }
  });

  if (columnIndex.noteInfo === -1) {
    return {
      ok: false,
      error: "未找到“笔记”信息列，请确认当前表格为笔记排行。"
    };
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return { ok: false, error: "未找到表格主体（tbody）。" };
  }

  const allRows = Array.from(tbody.querySelectorAll("tr")).filter(
    (tr) => tr.querySelectorAll("td").length > 0
  );

  // 每页第一行是你自己的账号，按需求跳过
  const rows = allRows.slice(1);

  const getCellText = (cell) =>
    cell
      ? (cell.innerText || cell.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : "";

  const data = rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("td"));

    const noteCell =
      columnIndex.noteInfo >= 0 ? cells[columnIndex.noteInfo] : undefined;

    const titleEl =
      noteCell?.querySelector(".note-title-wrapper .title") ||
      noteCell?.querySelector(".title") ||
      noteCell?.querySelector("a");

    const title = titleEl
      ? (titleEl.innerText || titleEl.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : getCellText(noteCell);

    const nicknameEl =
      noteCell?.querySelector(".anchor-info .anchor-name") ||
      noteCell?.querySelector(".anchor-name");

    const nickname = nicknameEl
      ? (nicknameEl.innerText || nicknameEl.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    const timeEl =
      noteCell?.querySelector(".note-time") ||
      noteCell?.querySelector(".publish-time");

    let publishTime = "";
    if (timeEl) {
      const raw = (timeEl.innerText || timeEl.textContent || "").trim();
      publishTime = raw.replace(/.*?发布时间[:：]?\s*/, "");
    }

    const getByIndex = (idx) =>
      idx >= 0 && idx < cells.length ? getCellText(cells[idx]) : "";

    const noteLinkEl =
      noteCell?.querySelector("a[href*='/note/'], a[href*='/notes/']");
    const noteUrl = noteLinkEl ? noteLinkEl.href : "";

    return {
      title,
      nickname,
      publishTime,
      readCount: getByIndex(columnIndex.readCount),
      clickRate: getByIndex(columnIndex.clickRate),
      payConversionRate: getByIndex(columnIndex.payConversionRate),
      gmv: getByIndex(columnIndex.gmv),
      noteUrl
    };
  });

  return { ok: true, rows: data };
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function mergeAndStoreRows(newRows, onDone) {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const existing = data[STORAGE_KEY] || [];
    const merged = [...existing, ...(newRows || [])];

    chrome.storage.local.set({ [STORAGE_KEY]: merged }, () => {
      if (onDone) onDone(merged, newRows || []);
    });
  });
}

function downloadCsvFromStorage() {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const rows = data[STORAGE_KEY] || [];
    if (rows.length === 0) {
      updatePanelStatus("没有可导出的数据，请先采集。");
      return;
    }

    const header = [
      "排名",
      "笔记标题",
      "账号昵称",
      "发布时间",
      "笔记阅读数",
      "笔记商品点击率",
      "笔记支付转化率",
      "笔记成交金额（元）"
    ];

    const lines = [header.map(csvEscape).join(",")];

    rows.forEach((row, index) => {
      lines.push(
        [
          index + 1,
          row.title,
          row.nickname,
          row.publishTime,
          row.readCount,
          row.clickRate,
          row.payConversionRate,
          row.gmv
        ]
          .map(csvEscape)
          .join(",")
      );
    });

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    a.href = url;
    a.download = `xhs_note_rank_${yyyy}${mm}${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updatePanelStatus(`已导出 ${rows.length} 行到 CSV。`);
  });
}

function updatePanelRowCount() {
  const el = document.getElementById("xhs-note-rank-row-count");
  if (!el) return;
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const rows = data[STORAGE_KEY] || [];
    el.textContent = String(rows.length);
  });
}

function updatePanelStatus(text) {
  const el = document.getElementById("xhs-note-rank-status");
  if (el) el.textContent = text || "";
}

function clearStoredRows() {
  chrome.storage.local.remove(STORAGE_KEY, () => {
    updatePanelRowCount();
    updatePanelStatus("缓存已清空。");
  });
}

function ensureSidePanel() {
  if (document.getElementById("xhs-note-rank-panel")) return;

  const panel = document.createElement("div");
  panel.id = "xhs-note-rank-panel";
  panel.style.position = "fixed";
  panel.style.right = "8px";
  panel.style.top = "120px";
  panel.style.zIndex = "999999";
  panel.style.background = "#ffffff";
  panel.style.border = "1px solid rgba(0,0,0,0.12)";
  panel.style.borderRadius = "4px";
  panel.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.15)";
  panel.style.padding = "8px 10px";
  panel.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  panel.style.fontSize = "12px";
  panel.style.color = "#1f2933";
  panel.style.maxWidth = "220px";

  panel.innerHTML = `
    <div style="font-weight:600;margin-bottom:4px;">热卖榜优秀内容排行导出</div>
    <div style="margin-bottom:4px;">
      已缓存行数：<span id="xhs-note-rank-row-count">0</span>
    </div>
    <div style="margin-bottom:4px;display:flex;flex-wrap:wrap;gap:4px;">
      <button id="xhs-note-rank-btn-collect" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">采集当前页</button>
      <button id="xhs-note-rank-btn-download" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">导出 CSV</button>
    </div>
    <div style="margin-bottom:4px;">
      <button id="xhs-note-rank-btn-clear" style="width:100%;padding:3px 6px;font-size:12px;cursor:pointer;">清空缓存</button>
    </div>
    <div id="xhs-note-rank-status" style="min-height:1.2em;color:#6b7280;"></div>
  `;

  document.body.appendChild(panel);

  const btnCollect = document.getElementById("xhs-note-rank-btn-collect");
  const btnDownload = document.getElementById("xhs-note-rank-btn-download");
  const btnClear = document.getElementById("xhs-note-rank-btn-clear");

  if (btnCollect) {
    btnCollect.addEventListener("click", () => {
      updatePanelStatus("正在采集当前页数据...");
      const result = collectNoteRankFromDom();
      if (!result.ok) {
        updatePanelStatus(result.error || "采集失败。");
        return;
      }
      mergeAndStoreRows(result.rows, (allRows, newRows) => {
        updatePanelRowCount();
        updatePanelStatus(
          `当前页采集完成，本次新增 ${newRows.length} 行，总计 ${allRows.length} 行。`
        );
      });
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      updatePanelStatus("正在导出 CSV...");
      downloadCsvFromStorage();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      clearStoredRows();
    });
  }

  updatePanelRowCount();
  updatePanelStatus("");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "collect-current-page") {
    try {
      const result = collectNoteRankFromDom();
      sendResponse(result);
    } catch (e) {
      sendResponse({
        ok: false,
        error: e && e.message ? e.message : "采集过程中发生错误。"
      });
    }
    return true;
  }
  return undefined;
});

// 页面加载完成后自动挂载右侧固定工具条
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", ensureSidePanel);
} else {
  ensureSidePanel();
}

// 覆盖导出函数：导出后自动清空缓存
function downloadCsvFromStorage() {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const rows = data[STORAGE_KEY] || [];
    if (rows.length === 0) {
      updatePanelStatus("没有可导出的数据，请先采集。");
      return;
    }

    const header = [
      "排名",
      "笔记标题",
      "账号昵称",
      "发布时间",
      "笔记阅读数",
      "笔记商品点击率",
      "笔记支付转化率",
      "笔记成交金额（元）"
    ];

    const lines = [header.map(csvEscape).join(",")];

    rows.forEach((row, index) => {
      lines.push(
        [
          index + 1,
          row.title,
          row.nickname,
          row.publishTime,
          row.readCount,
          row.clickRate,
          row.payConversionRate,
          row.gmv
        ]
          .map(csvEscape)
          .join(",")
      );
    });

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    a.href = url;
    a.download = `xhs_note_rank_${yyyy}${mm}${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    chrome.storage.local.remove(STORAGE_KEY, () => {
      updatePanelRowCount();
      updatePanelStatus(`已导出 ${rows.length} 行到 CSV，缓存已清空。`);
    });
  });
}
