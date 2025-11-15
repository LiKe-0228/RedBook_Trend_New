/* global chrome */

const STORAGE_KEY = "xhsNoteRankRows";

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text || "";
}

function updateRowCount() {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const rows = data[STORAGE_KEY] || [];
    const el = document.getElementById("row-count");
    if (el) el.textContent = String(rows.length);
  });
}

function getActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    callback(tabs[0]);
  });
}

function collectCurrentPage() {
  setStatus("正在采集当前页数据...");
  getActiveTab((tab) => {
    if (!tab || !tab.id) {
      setStatus("无法获取当前标签页。");
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: "collect-current-page" },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus("采集失败：页面上可能还未注入脚本。");
          return;
        }

        if (!response || !response.ok) {
          setStatus(response && response.error ? response.error : "未采集到数据。");
          return;
        }

        const newRows = response.rows || [];

        chrome.storage.local.get(STORAGE_KEY, (data) => {
          const existing = data[STORAGE_KEY] || [];
          const merged = [...existing, ...newRows];

          chrome.storage.local.set({ [STORAGE_KEY]: merged }, () => {
            setStatus(`当前页采集完成，本次新增 ${newRows.length} 行。`);
            updateRowCount();
          });
        });
      }
    );
  });
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv() {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const rows = data[STORAGE_KEY] || [];
    if (rows.length === 0) {
      setStatus("没有可导出的数据，请先采集。");
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
      updateRowCount();
      setStatus(`已导出 ${rows.length} 行到 CSV，缓存已清空。`);
    });
  });
}

function clearData() {
  chrome.storage.local.remove(STORAGE_KEY, () => {
    updateRowCount();
    setStatus("缓存已清空。");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("collect-page")
    ?.addEventListener("click", collectCurrentPage);
  document
    .getElementById("download-csv")
    ?.addEventListener("click", downloadCsv);
  document.getElementById("clear-data")?.addEventListener("click", clearData);

  updateRowCount();
  setStatus("");
});

