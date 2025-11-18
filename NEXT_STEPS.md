## 接下来要做的（简版）

1. 在 `config_local.py` 中补齐飞书应用与两张多维表（内容榜 / 账号榜）的配置和字段映射。
2. 重构 `upload_to_feishu.py`：抽出通用上传封装，新建 `upload_note_rows` 和 `upload_account_rows` 两个入口函数。
3. 新增 `feishu_api.py`，实现本地 HTTP 接口：`POST /upload_note_rank` 和 `POST /upload_account_rank`，内部调用上述封装上传到飞书。
4. 在 `xhs-note-rank-extension/note-rank-content.js` 中增加“上传内容榜到飞书 / 上传账号榜到飞书”按钮，与对应的 `fetch` 调用本地 API。
5. 在本机跑通完整链路（浏览器扩展采集 → 调用本地 API → 写入飞书多维表），根据结果微调字段映射和错误提示文案。

# 后续开发计划（XHS → 飞书集成说明）

## 目标

- 在不改变浏览器扩展采集逻辑的前提下：
  - 将「热卖榜-优秀内容」上传到飞书多维表格 A（现有逻辑整理后继续使用）。
  - 新增「成交榜-优秀账号」上传到飞书多维表格 B（新增表）。
- 一套代码在 Windows / macOS 上通用，从 GitHub 拉下代码后，只需配置本地变量即可使用。

---

## 1. 配置变量设计（config_local.py）

继续使用 `config_local.py` 承载本地私密配置，不提交到 Git。

### 1.1 飞书应用通用配置（两张表共用）

- `APP_ID`: 飞书应用的 App ID  
- `APP_SECRET`: 飞书应用的 App Secret  

这两个用于获取 `tenant_access_token`，内容榜和账号榜共用同一个应用即可。

### 1.2 多维表格配置：内容榜 & 账号榜分表

为避免混淆，建议显式区分两张表的配置。

- 内容榜（热卖榜-优秀内容，对应“笔记排行 CSV”）  
  - `BITABLE_NOTE_APP_TOKEN`: 多维表格应用 token（内容榜所在的多维表应用）  
  - `BITABLE_NOTE_TABLE_ID`: 内容榜那张表的 `table_id`

- 账号榜（成交榜-优秀账号，对应“成交榜账号 CSV”）  
  - `BITABLE_ACCOUNT_APP_TOKEN`: 多维表格应用 token（账号榜所在的多维表应用，可以与上面相同，也可以不同应用）  
  - `BITABLE_ACCOUNT_TABLE_ID`: 账号榜那张表的 `table_id`

说明：

- 如果两个榜都放在同一个多维表应用里，可以让 `BITABLE_NOTE_APP_TOKEN` 和 `BITABLE_ACCOUNT_APP_TOKEN` 填同一个值，只是 `TABLE_ID` 不同。  
- 保留一个可选端口配置（如后面需要调整端口）：  
  - `API_PORT = 8000  # 可选，默认 8000`

### 1.3 字段映射（FIELD_MAPPING）

在 Python 侧，为两张表分别维护字段映射（CSV 列名 → 飞书字段名）。

- 内容榜（已有逻辑，需要整理成常量）：  
  - `FIELD_MAPPING_NOTE = { ... }`

- 账号榜（新增）：  
  - `FIELD_MAPPING_ACCOUNT = { ... }`  

示例（需结合实际账号 CSV 列名调整）：

```python
FIELD_MAPPING_ACCOUNT = {
    "排名": "排名",
    "店铺名": "店铺名",
    "粉丝数": "粉丝数",
    "笔记阅读数": "笔记阅读数",
    "笔记商品点击数": "笔记商品点击数",
    "笔记支付转化数": "笔记支付转化数",
    "笔记成交金额（元）": "笔记成交金额（元）",
}
```

---

## 2. 重构现有上传脚本（upload_to_feishu.py → 可复用模块）

目标：从“单一脚本上传内容榜”改造为“通用模块 + 两个上传入口（内容榜 & 账号榜）”。

### 2.1 保留 / 整理的函数

- `get_tenant_access_token(app_id, app_secret) -> str`
- `read_csv_rows(csv_path: str) -> List[Dict[str, str]]`（仅 CLI 使用，可选）
- `to_bitable_records(rows, field_mapping) -> List[Dict]`
- `upload_to_bitable(token, app_token, table_id, records) -> int`

这些函数改造为与“榜单类型”无关的通用工具。

### 2.2 新增高层封装函数

- 内容榜上传：

  ```python
  def upload_note_rows(rows: List[Dict[str, str]]) -> int:
      """
      将热卖榜-优秀内容行数据写入内容榜表（BITABLE_NOTE_*）。
      返回写入记录数。
      """
  ```

- 账号榜上传：

  ```python
  def upload_account_rows(rows: List[Dict[str, str]]) -> int:
      """
      将成交榜-优秀账号行数据写入账号榜表（BITABLE_ACCOUNT_*）。
      返回写入记录数。
      """
  ```

内部逻辑：

- 统一调用 `get_tenant_access_token(APP_ID, APP_SECRET)`  
- 使用对应的 `FIELD_MAPPING_*` 和 `BITABLE_*_APP_TOKEN / BITABLE_*_TABLE_ID`  
- 调用 `upload_to_bitable()`

### 2.3 保留 CLI 入口（可选）

- 保留 `if __name__ == "__main__":` 做简单测试：
  - 从本地某个 CSV 读内容榜数据 → `upload_note_rows`
  - 或者从账号 CSV 读账号榜数据 → `upload_account_rows`

---

## 3. 提供本地 HTTP API（Flask / FastAPI）

新建 `feishu_api.py`（或类似命名），依赖：

- `requests`
- `flask`（或选择 FastAPI + uvicorn）

### 3.1 路由设计

两条独立路由，分别对应两张表。

- `POST /upload_note_rank`
  - 请求体（JSON）：`{ "rows": [...] }`
    - `rows`: 内容榜行数据数组，每项是一个 dict，字段名与 CSV 列一致（即扩展采集的字段）。
  - 后端流程：
    1. 校验 `rows`（非空、类型正确）
    2. `token = get_tenant_access_token(APP_ID, APP_SECRET)`
    3. 调用 `upload_note_rows(rows)`
    4. 返回：`{ "ok": true, "uploaded": <int> }` 或 `{ "ok": false, "error": "..." }`

- `POST /upload_account_rank`
  - 请求体（JSON）：`{ "rows": [...] }`
    - `rows`: 账号榜行数据数组，字段名与账号 CSV 一致（扩展采集的账号数据字段）。
  - 后端流程同上，只是调用 `upload_account_rows(rows)`。

### 3.2 监听地址 & 跨平台

- 统一监听：`127.0.0.1:8000`（可通过 `config_local.API_PORT` 调整）  
- Windows 启动示例：`python feishu_api.py`  
- macOS 启动示例：`python3 feishu_api.py`

两台电脑都运行相同的 `feishu_api.py` 和 `config_local.py` 结构，实现“同一份代码，两边只改配置即可用”。

---

## 4. 浏览器扩展侧改造（content script）

文件：`xhs-note-rank-extension/note-rank-content.js`

### 4.1 内容榜上传入口

- 新增按钮（建议放在“导出内容 CSV”附近）
  - 文案示例：“上传内容榜到飞书”
- 新增函数 `uploadNoteRankToFeishu()`
  - 使用 `chrome.storage.local.get(STORAGE_KEY)` 读取内容榜缓存行（或用当前采集结果）
  - 调用：

    ```js
    fetch("http://127.0.0.1:8000/upload_note_rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    ```

  - 根据响应：
    - 成功：在右侧状态栏显示“已上传至飞书，多维表格新增 N 条记录。”
    - 失败：显示错误信息（例如“本地上传服务未启动”“飞书返回错误”等）

### 4.2 账号榜上传入口

- 新增按钮（在“导出账号 CSV”附近）
  - 文案示例：“上传账号榜到飞书”
- 新增函数 `uploadAccountRankToFeishu()`
  - 使用 `chrome.storage.local.get(ACCOUNT_STORAGE_KEY)` 读取账号榜缓存行
  - 调用：

    ```js
    fetch("http://127.0.0.1:8000/upload_account_rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    ```

  - 状态提示同上。

### 4.3 上传策略

- 上传逻辑只在用户显式点击按钮时执行，不自动上传。  
- 上传前简单检查：
  - 若缓存行数为 0，提示“暂无可上传的数据，请先采集。”

---

## 5. 错误处理与可观测

### 5.1 Python API

- 每个路由用统一的错误包装：
  - 捕获异常，在日志中打印 traceback
  - 响应 `{ "ok": false, "error": "<简短错误描述>" }`
- 在控制台打印关键日志：
  - 收到的记录数
  - 成功写入的条数
  - 飞书返回的错误码 / 错误信息

### 5.2 扩展侧

- 处理 `fetch` 级别的错误：
  - 连接失败（本地服务没启动、端口不对）
  - 非 2xx HTTP 状态
- 对 API 返回 `ok: false` 的情况：
  - 统一读取并展示 `error` 文案
  - 提示可能的排查方向：
    - “请检查本地 feishu_api 是否运行”
    - “请检查 config_local.py 中的 APP_ID / 表配置是否正确”

---

## 6. 后续可选增强

- 在 Python 里记录“上传日期 / 获取时间”的统计，用于快速查看每日写入情况。  
- 增加简单的鉴权（例如在请求头里加一个固定 token，防止本机被其他程序滥用上传接口）。  
- 支持从扩展端传入“只上传某个获取时间的记录”（例如只传当日的 rows，Python 端按需过滤或直接写入）。

