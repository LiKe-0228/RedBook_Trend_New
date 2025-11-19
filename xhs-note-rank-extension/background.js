/* Background service worker: handles uploads to local Feishu API. */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "xhs-upload") {
    return undefined;
  }

  const { endpoint, rows } = message;

  if (!endpoint || !Array.isArray(rows)) {
    sendResponse({ ok: false, error: "参数错误：缺少 endpoint 或 rows。" });
    return true;
  }

  const url = `http://127.0.0.1:8000/${endpoint}`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows })
  })
    .then(async (resp) => {
      let body = null;
      try {
        body = await resp.json();
      } catch (_e) {
        // ignore JSON parse error
      }

      if (!resp.ok || !body) {
        sendResponse({
          ok: false,
          error:
            (body && body.error) ||
            `本地服务返回错误，HTTP ${resp.status}。`
        });
        return;
      }

      sendResponse(body);
    })
    .catch((err) => {
      console.error("upload error", err);
      sendResponse({
        ok: false,
        error:
          "无法连接本地上传服务，请确认 feishu_api 已在 127.0.0.1:8000 运行。"
      });
    });

  // 异步响应
  return true;
});
