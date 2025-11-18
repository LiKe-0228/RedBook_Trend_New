import csv
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import requests

try:
    # 本地私密配置（不会进 Git）：请在同目录创建 config_local.py 填写以下变量：
    # APP_ID, APP_SECRET, 以及多维表配置 / 字段映射
    import config_local as _cfg  # type: ignore
except ImportError as exc:  # pragma: no cover - 仅运行时检查
    raise SystemExit(
        "缺少本地配置文件 config_local.py，请在当前目录创建并配置 "
        "APP_ID, APP_SECRET 以及多维表相关参数。"
    ) from exc


# ---- 飞书应用与多维表配置（支持旧配置名向下兼容） ----

APP_ID: str = getattr(_cfg, "APP_ID", "")
APP_SECRET: str = getattr(_cfg, "APP_SECRET", "")

# 内容榜多维表（优先使用新命名；若不存在则回退到旧的 BITABLE_APP_TOKEN / BITABLE_TABLE_ID）
BITABLE_NOTE_APP_TOKEN: str = getattr(
    _cfg, "BITABLE_NOTE_APP_TOKEN", getattr(_cfg, "BITABLE_APP_TOKEN", "")
)
BITABLE_NOTE_TABLE_ID: str = getattr(
    _cfg, "BITABLE_NOTE_TABLE_ID", getattr(_cfg, "BITABLE_TABLE_ID", "")
)

# 账号榜多维表（如未单独配置，则默认与内容榜使用同一张表/应用）
BITABLE_ACCOUNT_APP_TOKEN: str = getattr(
    _cfg, "BITABLE_ACCOUNT_APP_TOKEN", BITABLE_NOTE_APP_TOKEN
)
BITABLE_ACCOUNT_TABLE_ID: str = getattr(
    _cfg, "BITABLE_ACCOUNT_TABLE_ID", BITABLE_NOTE_TABLE_ID
)

# 默认字段映射（可在 config_local.py 中通过 FIELD_MAPPING_NOTE / FIELD_MAPPING_ACCOUNT 覆盖）
DEFAULT_FIELD_MAPPING_NOTE: Dict[str, str] = {
    # key: 多维表字段名；value: CSV 列名
    "排名": "排名",
    "笔记标题": "笔记标题",
    "账号昵称": "账号昵称",
    "发布时间": "发布时间",
    "笔记阅读数": "笔记阅读数",
    "笔记商品点击数": "笔记商品点击数",
    "笔记支付转化数": "笔记支付转化数",
    "笔记成交金额（元）": "笔记成交金额（元）",
}

DEFAULT_FIELD_MAPPING_ACCOUNT: Dict[str, str] = {
    "排名": "排名",
    "店铺名": "店铺名",
    "粉丝数": "粉丝数",
    "笔记阅读数": "笔记阅读数",
    "笔记商品点击数": "笔记商品点击数",
    "笔记支付转化数": "笔记支付转化数",
    "笔记成交金额（元）": "笔记成交金额（元）",
}

FIELD_MAPPING_NOTE: Dict[str, str] = getattr(
    _cfg, "FIELD_MAPPING_NOTE", DEFAULT_FIELD_MAPPING_NOTE
)
FIELD_MAPPING_ACCOUNT: Dict[str, str] = getattr(
    _cfg, "FIELD_MAPPING_ACCOUNT", DEFAULT_FIELD_MAPPING_ACCOUNT
)


# 要上传的 CSV 文件路径（仅 CLI 调试使用，可按需修改）
CSV_PATH = "xhs_note_rank_20251116.csv"

# 每次批量写入的记录数上限（飞书目前上限是 500，这里保守一点）
BATCH_SIZE = 100


def get_tenant_access_token(
    app_id: Optional[str] = None, app_secret: Optional[str] = None
) -> str:
    """获取 tenant_access_token，可传入 app_id/app_secret 覆盖全局配置。"""
    app_id = app_id or APP_ID
    app_secret = app_secret or APP_SECRET

    if not app_id or not app_secret:
        raise SystemExit("APP_ID / APP_SECRET 未配置，请在 config_local.py 中填写。")

    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    resp = requests.post(
        url,
        json={"app_id": app_id, "app_secret": app_secret},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"get tenant_access_token failed: {data}")
    return data["tenant_access_token"]


def read_csv_rows(csv_path: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 跳过空行
            if not any((v or "").strip() for v in row.values()):
                continue
            rows.append(row)
    return rows


def to_bitable_records(
    csv_rows: List[Dict[str, str]], field_mapping: Dict[str, str]
) -> List[Dict]:
    records: List[Dict] = []

    numeric_fields = {"排名", "笔记阅读数", "笔记成交金额（元）", "粉丝数"}
    date_fields = {"发布时间"}

    for row in csv_rows:
        fields: Dict[str, object] = {}
        for bitable_field, csv_column in field_mapping.items():
            raw_value = row.get(csv_column, "")
            value = (raw_value or "").strip()

            if bitable_field in numeric_fields:
                try:
                    if value == "":
                        fields[bitable_field] = None
                    else:
                        fields[bitable_field] = float(value.replace(",", ""))
                except Exception:
                    fields[bitable_field] = value
            elif bitable_field in date_fields:
                try:
                    if value == "":
                        fields[bitable_field] = None
                    else:
                        dt = datetime.strptime(value, "%Y-%m-%d")
                        fields[bitable_field] = int(
                            dt.replace(tzinfo=timezone.utc).timestamp()
                        )
                except Exception:
                    fields[bitable_field] = value
            else:
                fields[bitable_field] = value

        records.append({"fields": fields})
    return records


def batch(iterable, size: int):
    for i in range(0, len(iterable), size):
        yield iterable[i : i + size]


def _clean_token(raw: str) -> str:
    # 防御性处理：有时会把带 ?view=... 或 &view=... 的完整 URL 片段粘到配置里
    return raw.split("&", 1)[0].split("?", 1)[0]


def upload_to_bitable(
    token: str, app_token: str, table_id: str, records: List[Dict]
) -> int:
    """通用上传封装：给定 token / app_token / table_id 与记录列表，批量写入多维表。"""
    app_token_clean = _clean_token(app_token)
    table_id_clean = _clean_token(table_id)

    if not app_token_clean or not table_id_clean:
        raise SystemExit("多维表 app_token / table_id 未配置，请检查 config_local.py。")

    url = (
        "https://open.feishu.cn/open-apis/bitable/v1/apps/"
        f"{app_token_clean}/tables/{table_id_clean}/records/batch_create"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    created_total = 0
    for chunk in batch(records, BATCH_SIZE):
        resp = requests.post(url, headers=headers, json={"records": chunk}, timeout=15)
        if resp.status_code >= 400:
            print("HTTP error:", resp.status_code, resp.text)
            resp.raise_for_status()

        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"batch_create failed: {data}")

        created = len(data.get("data", {}).get("records", []))
        created_total += created
        print(f"  已写入 {created_total} 条（本批 {created} 条）")
        time.sleep(0.3)

    print(f"写入完成，共写入 {created_total} 条记录。")
    return created_total


# ---- 高层封装：内容榜 / 账号榜上传 ----


def upload_note_rows(rows: List[Dict[str, str]]) -> int:
    """将热卖榜-优秀内容行数据写入内容榜多维表。"""
    if not rows:
        print("内容榜：没有可上传的记录。")
        return 0

    print(f"内容榜：准备上传 {len(rows)} 行记录。")
    token = get_tenant_access_token()
    records = to_bitable_records(rows, FIELD_MAPPING_NOTE)
    return upload_to_bitable(token, BITABLE_NOTE_APP_TOKEN, BITABLE_NOTE_TABLE_ID, records)


def upload_account_rows(rows: List[Dict[str, str]]) -> int:
    """将成交榜-优秀账号行数据写入账号榜多维表。"""
    if not rows:
        print("账号榜：没有可上传的记录。")
        return 0

    print(f"账号榜：准备上传 {len(rows)} 行记录。")
    token = get_tenant_access_token()
    records = to_bitable_records(rows, FIELD_MAPPING_ACCOUNT)
    return upload_to_bitable(
        token, BITABLE_ACCOUNT_APP_TOKEN, BITABLE_ACCOUNT_TABLE_ID, records
    )


def main():
    """简单 CLI：从本地 CSV 读取内容榜数据并上传（用于本地测试）。"""
    print("1) 从 CSV 读取内容榜数据：", CSV_PATH)
    csv_rows = read_csv_rows(CSV_PATH)
    print(f"   共读取 {len(csv_rows)} 行（不含表头）。")

    print("2) 上传到飞书多维表（内容榜）...")
    created = upload_note_rows(csv_rows)
    print(f"完成：共写入 {created} 条记录。")


if __name__ == "__main__":
    main()

