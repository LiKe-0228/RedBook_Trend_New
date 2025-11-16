import csv
import time
from datetime import datetime, timezone
from typing import Dict, List

import requests

try:
  # 本地私密配置（不会进 Git）：请在同目录创建 config_local.py 填写以下变量：
  # APP_ID, APP_SECRET, BITABLE_APP_TOKEN, BITABLE_TABLE_ID
  from config_local import (  # type: ignore
    APP_ID,
    APP_SECRET,
    BITABLE_APP_TOKEN,
    BITABLE_TABLE_ID,
  )
except ImportError as exc:  # pragma: no cover - 仅运行时检查
  raise SystemExit(
    "缺少本地配置文件 config_local.py，请在当前目录创建并配置 "
    "APP_ID, APP_SECRET, BITABLE_APP_TOKEN, BITABLE_TABLE_ID。"
  ) from exc


# 要上传的 CSV 文件路径（可以改成你最新导出的文件名）
CSV_PATH = "xhs_note_rank_20251116.csv"

# 多维表格里字段名称，要和你的表字段一一对应
# key 是表里的字段名，value 是 CSV 里的列名
FIELD_MAPPING = {
  "排名": "排名",
  "笔记标题": "笔记标题",
  "账号昵称": "账号昵称",
  "发布时间": "发布时间",
  "笔记阅读数": "笔记阅读数",
  "笔记商品点击率": "笔记商品点击率",
  "笔记支付转化率": "笔记支付转化率",
  "笔记成交金额（元）": "笔记成交金额（元）",
}

# 每次批量写入的记录数上限（飞书目前上限是 500，这里保守一点）
BATCH_SIZE = 100


# ========= 以下为脚本逻辑，一般不需要改 =========


def get_tenant_access_token() -> str:
  url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
  resp = requests.post(
    url,
    json={"app_id": APP_ID, "app_secret": APP_SECRET},
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


def to_bitable_records(csv_rows: List[Dict[str, str]]) -> List[Dict]:
  records: List[Dict] = []
  for row in csv_rows:
    fields: Dict[str, object] = {}
    for bitable_field, csv_column in FIELD_MAPPING.items():
      raw_value = row.get(csv_column, "")
      value = (raw_value or "").strip()

      # 数字字段：排名 / 阅读数 / 成交金额
      if bitable_field in {"排名", "笔记阅读数", "笔记成交金额（元）"}:
        try:
          if value == "":
            fields[bitable_field] = None
          else:
            fields[bitable_field] = float(value.replace(",", ""))
        except Exception:
          fields[bitable_field] = value

      # 日期字段：发布时间（飞书日期字段要求是 Unix 时间戳）
      elif bitable_field == "发布时间":
        try:
          if value == "":
            fields[bitable_field] = None
          else:
            # 允许 "2025-11-13" 这种格式
            dt = datetime.strptime(value, "%Y-%m-%d")
            fields[bitable_field] = int(dt.replace(tzinfo=timezone.utc).timestamp())
        except Exception:
          # 解析失败时按原字符串写入，避免整条记录报错
          fields[bitable_field] = value

      # 其他字段按文本写入
      else:
        fields[bitable_field] = value

    records.append({"fields": fields})
  return records


def batch(iterable, size):
  for i in range(0, len(iterable), size):
    yield iterable[i : i + size]


def upload_to_bitable(token: str, records: List[Dict]):
  # 防御性处理：有时会把带 ?view=... 或 &view=... 的整段 URL 粘到配置里
  # 这里统一去掉查询参数，只保留纯 app_token / table_id。
  app_token = BITABLE_APP_TOKEN.split("&", 1)[0].split("?", 1)[0]
  table_id = BITABLE_TABLE_ID.split("&", 1)[0].split("?", 1)[0]

  url = (
    f"https://open.feishu.cn/open-apis/bitable/v1/apps/"
    f"{app_token}/tables/{table_id}/records/batch_create"
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
    # 稍微歇一下，避免频率过高
    time.sleep(0.3)

  print(f"写入完成，共写入 {created_total} 条记录。")


def main():
  if "YOUR_APP_ID" in APP_ID or "YOUR_APP_SECRET" in APP_SECRET:
    raise SystemExit("请先在脚本顶部填写 APP_ID / APP_SECRET 等配置。")

  print("1) 获取 tenant_access_token ...")
  token = get_tenant_access_token()
  print("   OK")

  print(f"2) 从 CSV 读取数据：{CSV_PATH}")
  csv_rows = read_csv_rows(CSV_PATH)
  print(f"   共 {len(csv_rows)} 行（不含表头）。")

  print("3) 转换为多维表格 records 格式")
  records = to_bitable_records(csv_rows)

  print("4) 调用飞书多维表格 API 写入")
  upload_to_bitable(token, records)


if __name__ == "__main__":
  main()
