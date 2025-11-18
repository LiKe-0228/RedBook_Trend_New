"""
本文件为示例配置，请复制为 config_local.py 并填写真实参数。
config_local.py 已在 .gitignore 中配置，不会被提交到 GitHub。
"""

# ========= 1. 飞书应用基础配置 =========

# 飞书「企业自建应用」的 App ID / App Secret（示例占位符）
APP_ID = "YOUR_APP_ID"
APP_SECRET = "YOUR_APP_SECRET"


# ========= 2. 多维表格配置：内容榜 & 账号榜 =========

# 内容榜（热卖榜-优秀内容，对应「笔记排行 CSV」）
BITABLE_NOTE_APP_TOKEN = "YOUR_NOTE_APP_TOKEN"  # 多维表应用 token
BITABLE_NOTE_TABLE_ID = "YOUR_NOTE_TABLE_ID"  # 内容榜表的 table_id

# 账号榜（成交榜-优秀账号，对应「成交榜账号 CSV」）
# 如与内容榜在同一个多维表应用中，可以与 NOTE 共用 APP_TOKEN，只是 TABLE_ID 不同。
BITABLE_ACCOUNT_APP_TOKEN = "YOUR_ACCOUNT_APP_TOKEN"
BITABLE_ACCOUNT_TABLE_ID = "YOUR_ACCOUNT_TABLE_ID"


# ========= 3. 字段映射（CSV 列名 → 飞书字段名） =========

# 内容榜字段映射：键为飞书多维表字段名，值为 CSV 列名。
# 可以根据你在多维表中创建的字段实际名称调整。
FIELD_MAPPING_NOTE = {
    "排名": "排名",
    "笔记标题": "笔记标题",
    "账号昵称": "账号昵称",
    "发布时间": "发布时间",
    "笔记阅读数": "笔记阅读数",
    "笔记商品点击数": "笔记商品点击数",
    "笔记支付转化数": "笔记支付转化数",
    "笔记成交金额（元）": "笔记成交金额（元）",
    "获取时间": "获取时间",
}

# 账号榜字段映射：键为飞书多维表字段名，值为 CSV 列名。
FIELD_MAPPING_ACCOUNT = {
    "排名": "排名",
    "店铺名": "店铺名",
    "粉丝数": "粉丝数",
    "笔记阅读数": "笔记阅读数",
    "笔记商品点击数": "笔记商品点击数",
    "笔记支付转化数": "笔记支付转化数",
    "笔记成交金额（元）": "笔记成交金额（元）",
    "获取时间": "获取时间",
}


# ========= 4. 可选：本地 API 端口 =========

# 若后续使用 feishu_api.py 提供本地 HTTP 上传接口，可在此统一配置端口。
API_PORT = 8000

