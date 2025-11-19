# Data Management System（规划稿）

> 当前阶段按照 `NEXT_STEPS.md` 的顺序先做方案与接口对齐，不改动既有采集/上传代码。后续实现前后端时，代码仅放在本目录。

## 1. 数据模型（与 SQLite 保持一致）

- 数据库：`data/xhs_rank.db`
- 表结构：
  - `note_rank`：`uuid`，`title`，`nickname`，`publish_time`，`read_count`，`click_rate`，`pay_conversion_rate`，`gmv`，`fetch_date`，`created_at`（UTC+8）
  - `account_rank`：`uuid`，`shop_name`，`fans_count`，`read_count`，`click_rate`，`pay_conversion_rate`，`gmv`，`fetch_date`，`created_at`（UTC+8）
  - `audit_log`：`uuid`，`action`，`detail`，`created_at`（UTC+8）

## 2. 后端 API 设计（Flask）

基础约定：JSON 传输，返回 `{ ok: boolean, data?: any, error?: string }`；分页参数 `page`（默认 1），`page_size`（默认 20，最大 200）。

### 2.1 笔记榜 note_rank
- `GET /api/note_rank`：列表 & 筛选  
  - query：`page`，`page_size`，`q`（标题/昵称模糊），`fetch_date`，`fetch_date_from`，`fetch_date_to`，`publish_time_from`，`publish_time_to`，`order_by`（created_at|fetch_date|gmv），`order`（asc|desc）。
- `POST /api/note_rank`：创建单条  
  - body：`title`，`nickname`，`publish_time`，`read_count`，`click_rate`，`pay_conversion_rate`，`gmv`，`fetch_date`
- `PUT /api/note_rank/{uuid}`：更新  
  - body 同上（允许部分字段）。
- `DELETE /api/note_rank/{uuid}`：删除
- `GET /api/note_rank/export`：按当前筛选导出 CSV，响应 `text/csv`

### 2.2 账号榜 account_rank
- `GET /api/account_rank`：列表 & 筛选  
  - query：`page`，`page_size`，`q`（店铺名模糊），`fetch_date`，`fetch_date_from`，`fetch_date_to`，`fans_from`，`fans_to`（文本包含匹配），`order_by`（created_at|fetch_date|gmv），`order`（asc|desc）。
- `POST /api/account_rank`：创建单条  
  - body：`shop_name`，`fans_count`，`read_count`，`click_rate`，`pay_conversion_rate`，`gmv`，`fetch_date`
- `PUT /api/account_rank/{uuid}`：更新  
  - body 同上（允许部分字段）。
- `DELETE /api/account_rank/{uuid}`：删除
- `GET /api/account_rank/export`：按当前筛选导出 CSV，响应 `text/csv`

### 2.3 审计日志
- `GET /api/audit_log`：列表  
  - query：`page`，`page_size`，`action`，`detail_q`，`created_from`，`created_to`

### 2.4 认证与通用
- 简单 Token/Bearer 头部：`Authorization: Bearer <token>`（token 写在配置文件即可）。
- 错误：HTTP 4xx/5xx + `{ ok: false, error: "message" }`
- CORS：与现有扩展一致，允许本机前端 dev server。

## 3. 前端（React + Vite + TS + AntD）规划

- 目录（待创建）：  
  - `frontend/`（Vite 工程）  
  - `frontend/src/api/`：axios 封装、类型定义  
  - `frontend/src/pages/NoteRank.tsx`、`AccountRank.tsx`、`AuditLog.tsx`  
  - `frontend/src/components/`：表格、筛选表单、编辑抽屉
- 状态与接口约定：  
  - 分页：`page` / `page_size`，响应 `{ ok: true, data: { items, total } }`  
  - 列表默认排序：`fetch_date` desc，其次 created_at desc  
  - 编辑表单字段与上方 API 同步；uuid 由后端生成  
  - 双端口开发：前端 dev server 代理到 `http://127.0.0.1:8000/api`
- 导出：前端调用 `/export` 返回的 CSV 或用当前列表数据 client-side 生成（优先后端）。

## 4. 落地顺序（针对本目录）

1) 固化 API/类型定义：生成 OpenAPI 草稿或 TypeScript 类型（下一步落地）。  
2) 初始化 Vite + TS + AntD 工程到 `Data Management System/frontend`，配置代理到 8000。  
3) 实现列表/筛选/增删改查/导出页面。  
4) 与后端接口联调，补充审计日志与鉴权。  

> 本文件是阶段性规划文档，确保前后端字段命名和接口一致，便于后续直接开工。
