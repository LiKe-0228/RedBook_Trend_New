/* 在右侧面板中增加“上传到飞书”按钮，并通过扩展后台调用本地 Feishu API。 */

(() => {
  const NOTE_STORAGE_KEY = "xhsNoteRankRows";
  const ACCOUNT_STORAGE_KEY = "xhsAccountRankRows";

  function setStatus(text) {
    const el = document.getElementById("xhs-note-rank-status");
    if (el) el.textContent = text || "";
  }

  function waitForPanel(callback) {
    const panel = document.getElementById("xhs-note-rank-panel");
    if (panel) {
      callback(panel);
      return;
    }

    const observer = new MutationObserver(() => {
      const p = document.getElementById("xhs-note-rank-panel");
      if (p) {
        observer.disconnect();
        callback(p);
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  }

  function attachUploadButtons(panel) {
    // 内容榜上传按钮：单独一行，全宽
    const noteDownloadBtn = panel.querySelector("#xhs-note-rank-btn-download");
    if (noteDownloadBtn && !panel.querySelector("#xhs-note-rank-btn-upload")) {
      const row = noteDownloadBtn.closest("div");
      const uploadRow = document.createElement("div");
      uploadRow.style.marginBottom = "4px";

      const uploadBtn = document.createElement("button");
      uploadBtn.id = "xhs-note-rank-btn-upload";
      uploadBtn.textContent = "上传内容榜到飞书";
      uploadBtn.style.width = "100%";
      uploadBtn.style.padding = "3px 6px";
      uploadBtn.style.fontSize = "12px";
      uploadBtn.style.cursor = "pointer";

      uploadRow.appendChild(uploadBtn);
      if (row && row.parentNode) {
        row.parentNode.insertBefore(uploadRow, row.nextSibling);
      } else {
        const statusEl = panel.querySelector("#xhs-note-rank-status");
        panel.insertBefore(uploadRow, statusEl || null);
      }
    }

    // 账号榜上传按钮：与账号相关按钮在同一行
    const accountDownloadBtn = panel.querySelector(
      "#xhs-account-rank-btn-download"
    );
    if (
      accountDownloadBtn &&
      !panel.querySelector("#xhs-account-rank-btn-upload")
    ) {
      const uploadBtn = document.createElement("button");
      uploadBtn.id = "xhs-account-rank-btn-upload";
      uploadBtn.textContent = "上传账号榜到飞书";
      uploadBtn.style.flex = "1 0 90px";
      uploadBtn.style.padding = "3px 6px";
      uploadBtn.style.fontSize = "12px";
      uploadBtn.style.cursor = "pointer";

      const row = accountDownloadBtn.closest("div");
      if (row) {
        row.style.display = "flex";
        row.style.flexWrap = "wrap";
        row.style.gap = "4px";
        row.appendChild(uploadBtn);
      }
    }

    bindUploadHandlers();
  }

  function bindUploadHandlers() {
    const noteUploadBtn = document.getElementById("xhs-note-rank-btn-upload");
    if (noteUploadBtn && !noteUploadBtn.dataset.xhsBound) {
      noteUploadBtn.dataset.xhsBound = "1";
      noteUploadBtn.addEventListener("click", () => {
        setStatus("正在上传内容榜至飞书...");
        chrome.storage.local.get(NOTE_STORAGE_KEY, (data) => {
          const rows = data[NOTE_STORAGE_KEY] || [];
          if (!rows.length) {
            setStatus("暂无可上传的内容榜数据，请先采集。");
            return;
          }

          chrome.runtime.sendMessage(
            { type: "xhs-upload", endpoint: "upload_note_rank", rows },
            (res) => {
              if (chrome.runtime.lastError) {
                console.error("xhs-upload note error:", chrome.runtime.lastError);
                setStatus("无法连接扩展后台，请在扩展页重新加载后重试。");
                return;
              }
              if (!res || res.ok !== true) {
                setStatus(
                  (res && res.error) ||
                    "上传内容榜到飞书失败，请检查本地服务或配置。"
                );
                return;
              }
              setStatus(
                `已上传内容榜，多维表新增 ${res.uploaded || 0} 条记录。`
              );
            }
          );
        });
      });
    }

    const accountUploadBtn = document.getElementById(
      "xhs-account-rank-btn-upload"
    );
    if (accountUploadBtn && !accountUploadBtn.dataset.xhsBound) {
      accountUploadBtn.dataset.xhsBound = "1";
      accountUploadBtn.addEventListener("click", () => {
        setStatus("正在上传账号榜至飞书...");
        chrome.storage.local.get(ACCOUNT_STORAGE_KEY, (data) => {
          const rows = data[ACCOUNT_STORAGE_KEY] || [];
          if (!rows.length) {
            setStatus("暂无可上传的账号榜数据，请先采集。");
            return;
          }

          chrome.runtime.sendMessage(
            { type: "xhs-upload", endpoint: "upload_account_rank", rows },
            (res) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "xhs-upload account error:",
                  chrome.runtime.lastError
                );
                setStatus("无法连接扩展后台，请在扩展页重新加载后重试。");
                return;
              }
              if (!res || res.ok !== true) {
                setStatus(
                  (res && res.error) ||
                    "上传账号榜到飞书失败，请检查本地服务或配置。"
                );
                return;
              }
              setStatus(
                `已上传账号榜，多维表新增 ${res.uploaded || 0} 条记录。`
              );
            }
          );
        });
      });
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => {
      waitForPanel(attachUploadButtons);
    });
  } else {
    waitForPanel(attachUploadButtons);
  }
})();

