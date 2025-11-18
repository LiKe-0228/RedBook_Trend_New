## 后续计划：本地 SQLite 存储

目标：让 SQLite 成为“主数据仓库”，飞书只作为备份/共享渠道。

---

### 1. 设计概要

- 新建 SQLite 库文件：`data/xhs_rank.db`（相对当前项目根目录）。
- 建两张表：
  - `note_rank`（内容榜）
  - `account_rank`（账号榜）
- 字段与当前上传飞书的字段对应：
  - 内容榜 `note_rank`：  
    - `id`（自增主键）  
    - `fetch_date`（获取时间，文本）  
    - `title`（笔记标题）  
    - `nickname`（账号昵称）  
    - `publish_time`（发布时间，文本）  
    - `read_count`（笔记阅读数，文本，允许“1万-3万”这类区间）  
    - `click_rate`（笔记商品点击率，文本）  
    - `pay_conversion_rate`（笔记支付转化率，文本）  
    - `gmv`（笔记成交金额（元），文本，允许区间）  
    - `note_url`（笔记链接）  
    - `created_at`（写入时间，时间戳或文本）  
  - 账号榜 `account_rank`：  
    - `id`（自增主键）  
    - `fetch_date`（获取时间）  
    - `shop_name`（店铺名）  
    - `fans_count`（粉丝数，文本/数字都可）  
    - `read_count`（笔记阅读数）  
    - `click_rate`（笔记商品点击率）  
    - `pay_conversion_rate`（笔记支付转化率）  
    - `gmv`（笔记成交金额（元））  
    - `created_at`（写入时间）  

---

### 2. 代码改造计划（暂不实施，先记 TODO）

1. 新建 `storage_sqlite.py`：
   - `init_db_if_needed(db_path: str) -> None`  
     - 如果 `data/xhs_rank.db` 不存在，则创建并建表。  
   - `insert_note_rows(rows: List[Dict[str, Any]]) -> int`  
     - 批量插入内容榜行，返回插入行数。  
   - `insert_account_rows(rows: List[Dict[str, Any]]) -> int`  
     - 批量插入账号榜行，返回插入行数。  

2. 在 `feishu_api.py` 中：
   - 路由 `/upload_note_rank`：先调用 `insert_note_rows(rows)` 落库，再调用 `upload_note_rows(rows)` 备份到飞书。  
   - 路由 `/upload_account_rank`：先调用 `insert_account_rows(rows)`，再调用 `upload_account_rows(rows)`。  
   - 确保无论飞书上传成功/失败，本地 SQLite 都已经保存到数据（飞书只作为备份）。  

3. 保留现有 CSV CLI 功能：
   - `upload_to_feishu.py` 里的 `main()` 仍然可以从 CSV 读一批数据上传飞书。  
   - 后续可选：增加一个 CLI，将 CSV 导入 SQLite，或从 SQLite 导出 CSV。  

---

### 3. 使用与备份策略（规划）

- 默认 SQLite 文件路径：`data/xhs_rank.db`。  
- 换电脑时，只需要把项目目录连同 `data/xhs_rank.db` 一起拷贝，即可保留所有历史数据。  
- 定期备份方式：
  - 简单版本：手动复制 `data/xhs_rank.db` 到网盘 / 移动硬盘。  
  - 进阶版本（以后再做）：写一个 `backup_db.py`，打一个带时间戳的压缩包到 `backup/` 目录。  

