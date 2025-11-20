/* global chrome */

// 本地存储 key
const STORAGE_KEY = "xhsNoteRankRows"; // 内容榜（笔记排行）
const ACCOUNT_STORAGE_KEY = "xhsAccountRankRows"; // 成交榜优秀账号

// 是否排除每页第一行（通常为自营账号）
// 默认：false（包含第一行）
let excludeFirstRow = false;

// 规范化表头/单元格文本
function normalizeText(text) {
  return (text || "")
    .replace(/\s+/g, "")
    .replace(/\uFFFD/g, "")
    .trim();
}

// 获取“逻辑上的获取日期”（只有日期，不含时间）
// 规则：如果当前时间 < 10:00，则视为前一天的数据；否则视为当天的数据
function getLogicalFetchDate() {
  const now = new Date();
  const adjusted = new Date(now);

  if (now.getHours() < 10) {
    adjusted.setDate(adjusted.getDate() - 1);
  }

  const yyyy = adjusted.getFullYear();
  const mm = String(adjusted.getMonth() + 1).padStart(2, "0");
  const dd = String(adjusted.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 从「市场行情-笔记排行」页面抽取当前页数据（内容榜）
 */
function collectNoteRankFromDom() {
  const root =
    document.querySelector(".note-rank") ||
    document.querySelector("[data-v-7d4260ee] .note-rank") ||
    document.body;

  if (!root) {
    return {
      ok: false,
      error: "未找到 note-rank 容器，请确认当前为笔记排行页面。"
    };
  }

  const table =
    root.querySelector("table") ||
    root.querySelector(".d-table table") ||
    root.querySelector("tbody")?.closest("table");

  if (!table) {
    return {
      ok: false,
      error: "未找到表格，请确认已切换到“笔记排行”并等待页面加载完成。"
    };
  }

  const headerCells = Array.from(
    table.querySelectorAll("thead tr th, thead tr td")
  );

  if (headerCells.length === 0) {
    return { ok: false, error: "未找到表头，请确认页面已完全加载。" };
  }

  const columnIndex = {
    noteInfo: -1,
    readCount: -1,
    clickRate: -1,
    payConversionRate: -1,
    gmv: -1
  };

  headerCells.forEach((cell, index) => {
    const text = normalizeText(cell.textContent);
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

  // 根据配置决定是否跳过第一行
  const rows = excludeFirstRow ? allRows.slice(1) : allRows;

  const getCellText = (cell) =>
    cell
      ? (cell.innerText || cell.textContent || "").replace(/\s+/g, " ").trim()
      : "";

  const fetchDate = getLogicalFetchDate();

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

    return {
      title,
      nickname,
      publishTime,
      readCount: getByIndex(columnIndex.readCount),
      clickRate: getByIndex(columnIndex.clickRate),
      payConversionRate: getByIndex(columnIndex.payConversionRate),
      gmv: getByIndex(columnIndex.gmv),
      fetchDate
    };
  });

  return { ok: true, rows: data };
}

/**
 * 从「成交榜-优秀账号排行」页面抽取当前页账号数据
 */
function collectAccountRankFromDom() {
  const root =
    document.querySelector(".note-rank") ||
    document.querySelector("[data-v-7d4260ee] .note-rank") ||
    document.body;

  if (!root) {
    return {
      ok: false,
      error: "未找到成交榜容器，请确认当前为成交榜页面。"
    };
  }

  const table =
    root.querySelector("table") ||
    root.querySelector(".d-table table") ||
    root.querySelector("tbody")?.closest("table");

  if (!table) {
    return { ok: false, error: "未找到成交榜表格，请确认页面已完全加载。" };
  }

  const headerCells = Array.from(
    table.querySelectorAll("thead tr th, thead tr td")
  );

  if (headerCells.length === 0) {
    return { ok: false, error: "未找到成交榜表头，请确认页面已完全加载。" };
  }

  const columnIndex = {
    accountInfo: -1,
    readCount: -1,
    clickRate: -1,
    payConversionRate: -1,
    gmv: -1
  };

  headerCells.forEach((cell, index) => {
    const text = normalizeText(cell.textContent);
    if (!text) return;

    // 成交榜账号列表头有时叫「账号」，有时叫「店铺」
    if (
      (text.includes("账号") || text.includes("店铺")) &&
      !text.includes("粉丝") &&
      !text.includes("阅读") &&
      !text.includes("成交")
    ) {
      columnIndex.accountInfo = index;
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

  if (columnIndex.accountInfo === -1) {
    return {
      ok: false,
      error: "未找到账号信息列，请确认当前表格为成交榜-优秀账号排行。"
    };
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return { ok: false, error: "未找到成交榜表格主体（tbody）。" };
  }

  const allRows = Array.from(tbody.querySelectorAll("tr")).filter(
    (tr) => tr.querySelectorAll("td").length > 0
  );

  // 根据配置决定是否跳过第一行
  const rows = excludeFirstRow ? allRows.slice(1) : allRows;

  const getCellText = (cell) =>
    cell
      ? (cell.innerText || cell.textContent || "").replace(/\s+/g, " ").trim()
      : "";

  const fetchDate = getLogicalFetchDate();

  const data = rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("td"));

    const accountCell =
      columnIndex.accountInfo >= 0 ? cells[columnIndex.accountInfo] : undefined;

    const nicknameEl =
      accountCell?.querySelector(".anchor-name") ||
      accountCell?.querySelector(".user-info-top .title") ||
      accountCell?.querySelector(".title");

    const shopName = nicknameEl
      ? (nicknameEl.innerText || nicknameEl.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : getCellText(accountCell);

    const fansEl =
      accountCell?.querySelector(".user-fans") ||
      accountCell?.querySelector(".anchor-fans");
    let fansCount = "";
    if (fansEl) {
      const raw = (fansEl.innerText || fansEl.textContent || "").trim();
      fansCount = raw.replace(/粉丝/g, "").trim();
    }

    const readCount =
      columnIndex.readCount >= 0
        ? getCellText(cells[columnIndex.readCount])
        : "";
    const clickRate =
      columnIndex.clickRate >= 0
        ? getCellText(cells[columnIndex.clickRate])
        : "";
    const payConversionRate =
      columnIndex.payConversionRate >= 0
        ? getCellText(cells[columnIndex.payConversionRate])
        : "";
    const gmv =
      columnIndex.gmv >= 0 ? getCellText(cells[columnIndex.gmv]) : "";

    return {
      shopName,
      fansCount,
      readCount,
      clickRate,
      payConversionRate,
      gmv,
      fetchDate
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

function mergeAndStoreAccountRows(newRows, onDone) {
  chrome.storage.local.get(ACCOUNT_STORAGE_KEY, (data) => {
    const existing = data[ACCOUNT_STORAGE_KEY] || [];
    const merged = [...existing, ...(newRows || [])];

    chrome.storage.local.set({ [ACCOUNT_STORAGE_KEY]: merged }, () => {
      if (onDone) onDone(merged, newRows || []);
    });
  });
}

function downloadCsvFromStorage() {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const rows = data[STORAGE_KEY] || [];
    if (rows.length === 0) {
      updatePanelStatus("没有可导出的内容数据，请先采集。");
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
      "笔记成交金额（元）",
      "获取时间"
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
          row.gmv,
          row.fetchDate || ""
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
      updatePanelStatus(
        `已导出 ${rows.length} 行内容数据到 CSV，内容缓存已清空。`
      );
    });
  });
}

function downloadAccountCsvFromStorage() {
  chrome.storage.local.get(ACCOUNT_STORAGE_KEY, (data) => {
    const rows = data[ACCOUNT_STORAGE_KEY] || [];
    if (rows.length === 0) {
      updatePanelStatus("没有可导出的账号数据，请先采集成交榜账号。");
      return;
    }

    const header = [
      "排名",
      "店铺名",
      "粉丝数",
      "笔记阅读数",
      "笔记商品点击率",
      "笔记支付转化率",
      "笔记成交金额（元）",
      "获取时间"
    ];
    const lines = [header.map(csvEscape).join(",")];

    rows.forEach((row, index) => {
      lines.push(
        [
          index + 1,
          row.shopName,
          row.fansCount,
          row.readCount,
          row.clickRate,
          row.payConversionRate,
          row.gmv,
          row.fetchDate || ""
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
    a.download = `xhs_account_rank_${yyyy}${mm}${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    chrome.storage.local.remove(ACCOUNT_STORAGE_KEY, () => {
      updateAccountPanelRowCount();
      updatePanelStatus(
        `已导出 ${rows.length} 行账号数据到 CSV，账号缓存已清空。`
      );
    });
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

function updateAccountPanelRowCount() {
  const el = document.getElementById("xhs-account-rank-row-count");
  if (!el) return;
  chrome.storage.local.get(ACCOUNT_STORAGE_KEY, (data) => {
    const rows = data[ACCOUNT_STORAGE_KEY] || [];
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
    updatePanelStatus("内容缓存已清空。");
  });
}

function clearStoredAccountRows() {
  chrome.storage.local.remove(ACCOUNT_STORAGE_KEY, () => {
    updateAccountPanelRowCount();
    updatePanelStatus("账号缓存已清空。");
  });
}

function updateFirstRowToggleButton() {
  const btn = document.getElementById("xhs-toggle-first-row");
  if (!btn) return;
  btn.textContent = excludeFirstRow
    ? "当前：排除每页第 1 行"
    : "当前：包含每页第 1 行";
}

// 检查页面左下角的每页记录数下拉，是否已经是 50 条
function isPageSize50() {
  const wrapper = document.querySelector(
    ".d-select-wrapper.d-inline-block[hideafterselect='true']"
  );
  if (!wrapper) {
    return null; // 未找到控件
  }
  const text = (wrapper.innerText || wrapper.textContent || "")
    .replace(/\s+/g, "")
    .trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return digits === "50";
}

// 确保每页记录数为 50；否则自动滚动到底部并提示用户手动切换
function ensurePageSize50OrWarn() {
  const result = isPageSize50();
  if (result === true) {
    return true;
  }

  const container = document.getElementById(
    "ark-app-datacenterark-mount-container"
  );
  const scrollElement =
    container ||
    document.scrollingElement ||
    document.documentElement ||
    document.body;
  const targetTop =
    (scrollElement && scrollElement.scrollHeight) ||
    document.body.scrollHeight ||
    0;

  try {
    scrollElement.scrollTo({
      top: targetTop,
      behavior: "smooth"
    });
  } catch (_e) {
    scrollElement.scrollTop = targetTop;
  }

  if (result === false) {
    updatePanelStatus(
      "当前每页记录数不是 50 条，请先在页面左下角将每页记录数切换为 50，再点击采集。"
    );
  } else {
    updatePanelStatus(
      "未能检测到记录数下拉控件，请确认页面加载完成，并将每页记录数切换为 50 后再采集。"
    );
  }

  return false;
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
  panel.style.padding = "8px 12px";
  panel.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  panel.style.fontSize = "12px";
  panel.style.color = "#1f2933";
  panel.style.width = "300px";
  panel.style.minWidth = "280px";
  panel.style.maxWidth = "320px";

  panel.innerHTML = `
    <div style="margin-bottom:6px;">
      <button id="xhs-toggle-first-row" style="width:100%;padding:3px 6px;font-size:12px;cursor:pointer;">
        当前：包含每页第 1 行
      </button>
    </div>

    <div style="font-weight:600;margin-bottom:6px;">热卖榜优秀内容采集</div>
    <div style="margin-bottom:4px;">
      内容榜缓存：<span id="xhs-note-rank-row-count">0</span>
    </div>
    <div style="margin-bottom:4px;display:flex;flex-wrap:wrap;gap:4px;">
      <button id="xhs-note-rank-btn-collect" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">采集内容当前页</button>
      <button id="xhs-note-rank-btn-download" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">导出内容 CSV</button>
      <button id="xhs-note-rank-btn-upload" style="flex:0 0 100%;max-width:100%";padding:3px 6px;font-size:12px;cursor:pointer;">上传内容榜到飞书</button>
    </div>
    <div style="margin-bottom:8px;">
      <button id="xhs-note-rank-btn-clear" style="width:100%;padding:3px 6px;font-size:12px;cursor:pointer;">清空内容缓存</button>
    </div>

    <div style="font-weight:600;margin:4px 0 4px;">成交榜优秀账号采集</div>
    <div style="margin-bottom:4px;">
      成交榜账号缓存：<span id="xhs-account-rank-row-count">0</span>
    </div>
    <div style="margin-bottom:4px;display:flex;flex-wrap:wrap;gap:4px;">
      <button id="xhs-account-rank-btn-collect" style="flex:1.5 0 120px;padding:3px 6px;font-size:12px;cursor:pointer;">采集成交榜账号当前页</button>
      <button id="xhs-account-rank-btn-download" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">导出账号 CSV</button>
      <button id="xhs-account-rank-btn-upload" style="flex:0 0 100%;max-width:100%";padding:3px 6px;font-size:12px;cursor:pointer;">上传账号榜到飞书</button>
    </div>
    <div style="margin-bottom:4px;">
      <button id="xhs-account-rank-btn-clear" style="width:100%;padding:3px 6px;font-size:12px;cursor:pointer;">清空账号缓存</button>
    </div>

    <div style="margin-bottom:4px;display:flex;flex-wrap:wrap;gap:4px;">
      <button id="xhs-scroll-to-bottom" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">滚动到页面底部</button>
      <button id="xhs-scroll-to-top" style="flex:1 0 90px;padding:3px 6px;font-size:12px;cursor:pointer;">滚动到页面顶部</button>
    </div>

    <div id="xhs-note-rank-status" style="min-height:1.2em;color:#6b7280;"></div>
  `;

  document.body.appendChild(panel);

  const btnToggleFirst = document.getElementById("xhs-toggle-first-row");
  const btnCollect = document.getElementById("xhs-note-rank-btn-collect");
  const btnDownload = document.getElementById("xhs-note-rank-btn-download");
  const btnUpload = document.getElementById("xhs-note-rank-btn-upload");
  const btnClear = document.getElementById("xhs-note-rank-btn-clear");
  const btnAccountCollect = document.getElementById(
    "xhs-account-rank-btn-collect"
  );
  const btnAccountDownload = document.getElementById(
    "xhs-account-rank-btn-download"
  );
  const btnAccountUpload = document.getElementById(
    "xhs-account-rank-btn-upload"
  );
  const btnAccountClear = document.getElementById(
    "xhs-account-rank-btn-clear"
  );
  const btnScrollTop = document.getElementById("xhs-scroll-to-top");
  const btnScrollBottom = document.getElementById("xhs-scroll-to-bottom");

  if (btnToggleFirst) {
    btnToggleFirst.addEventListener("click", () => {
      excludeFirstRow = !excludeFirstRow;
      updateFirstRowToggleButton();
      updatePanelStatus(
        excludeFirstRow
          ? "已设置：采集时排除每页第 1 行。"
          : "已设置：采集时包含每页第 1 行。"
      );
    });
    updateFirstRowToggleButton();
  }

  if (btnCollect) {
    btnCollect.addEventListener("click", () => {
      if (!ensurePageSize50OrWarn()) {
        return;
      }
      updatePanelStatus("正在采集内容榜当前页数据...");
      const result = collectNoteRankFromDom();
      if (!result.ok) {
        updatePanelStatus(result.error || "采集内容榜失败。");
        return;
      }
      mergeAndStoreRows(result.rows, (allRows, newRows) => {
        updatePanelRowCount();
        updatePanelStatus(
          `内容榜采集完成，本次新增 ${newRows.length} 行，总计 ${allRows.length} 行。`
        );
      });
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      updatePanelStatus("正在导出内容 CSV...");
      downloadCsvFromStorage();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      clearStoredRows();
    });
  }

  if (btnAccountCollect) {
    btnAccountCollect.addEventListener("click", () => {
      if (!ensurePageSize50OrWarn()) {
        return;
      }
      updatePanelStatus("正在采集成交榜账号当前页数据...");
      const result = collectAccountRankFromDom();
      if (!result.ok) {
        updatePanelStatus(result.error || "采集成交榜账号失败。");
        return;
      }
      mergeAndStoreAccountRows(result.rows, (allRows, newRows) => {
        updateAccountPanelRowCount();
        updatePanelStatus(
          `成交榜账号采集完成，本次新增 ${newRows.length} 行，总计 ${allRows.length} 行。`
        );
      });
    });
  }

  if (btnAccountDownload) {
    btnAccountDownload.addEventListener("click", () => {
      updatePanelStatus("正在导出账号 CSV...");
      downloadAccountCsvFromStorage();
    });
  }

  if (btnAccountClear) {
    btnAccountClear.addEventListener("click", () => {
      clearStoredAccountRows();
    });
  }

  if (btnScrollTop) {
    btnScrollTop.addEventListener("click", () => {
      const container = document.getElementById(
        "ark-app-datacenterark-mount-container"
      );
      const scrollElement =
        container ||
        document.scrollingElement ||
        document.documentElement ||
        document.body;

      try {
        scrollElement.scrollTo({ top: 0, behavior: "smooth" });
      } catch (_e) {
        scrollElement.scrollTop = 0;
      }
    });
  }

  if (btnScrollBottom) {
    btnScrollBottom.addEventListener("click", () => {
      const container = document.getElementById(
        "ark-app-datacenterark-mount-container"
      );

      const scrollElement =
        container ||
        document.scrollingElement ||
        document.documentElement ||
        document.body;

      const targetTop =
        (scrollElement && scrollElement.scrollHeight) ||
        document.body.scrollHeight ||
        0;

      try {
        scrollElement.scrollTo({
          top: targetTop,
          behavior: "smooth"
        });
      } catch (_e) {
        scrollElement.scrollTop = targetTop;
      }
    });
  }

  updatePanelRowCount();
  updateAccountPanelRowCount();
  updatePanelStatus("");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "collect-current-page") {
    try {
      if (!ensurePageSize50OrWarn()) {
        sendResponse({
          ok: false,
          error: "请先将每页记录数切换为 50，再采集。"
        });
        return true;
      }
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
// Swap order of scroll buttons
(function () {
  function adjustScrollButtonsOrder() {
    var topBtn = document.getElementById("xhs-scroll-to-top");
    var bottomBtn = document.getElementById("xhs-scroll-to-bottom");
    if (!topBtn || !bottomBtn) return;
    bottomBtn.style.order = "1";
    topBtn.style.order = "2";
  }
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", adjustScrollButtonsOrder);
  } else {
    adjustScrollButtonsOrder();
  }
})();
