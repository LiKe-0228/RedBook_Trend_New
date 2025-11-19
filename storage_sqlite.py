from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable
from typing import List, Tuple

DB_PATH = Path("data/xhs_rank.db")


def _ensure_db_dir(db_path: Path) -> None:
  db_path.parent.mkdir(parents=True, exist_ok=True)


def _now_iso() -> str:
  tz = timezone(timedelta(hours=8))  # 东八区
  return datetime.now(tz).isoformat(timespec="seconds")


def _new_uuid() -> str:
  return str(uuid.uuid4())


def _normalize_value(value: Any) -> str:
  # Store as text for flexibility (区间、百分比等)
  if value is None:
    return ""
  return str(value).strip()


def init_db_if_needed(db_path: Path = DB_PATH) -> None:
  """Create SQLite file and tables if they do not exist."""
  _ensure_db_dir(db_path)
  with sqlite3.connect(db_path) as conn:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS note_rank (
        uuid TEXT PRIMARY KEY,
        title TEXT,
        nickname TEXT,
        publish_time TEXT,
        read_count TEXT,
        click_rate TEXT,
        pay_conversion_rate TEXT,
        gmv TEXT,
        fetch_date TEXT,
        created_at TEXT
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS account_rank (
        uuid TEXT PRIMARY KEY,
        shop_name TEXT,
        fans_count TEXT,
        read_count TEXT,
        click_rate TEXT,
        pay_conversion_rate TEXT,
        gmv TEXT,
        fetch_date TEXT,
        created_at TEXT
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS audit_log (
        uuid TEXT PRIMARY KEY,
        action TEXT,
        detail TEXT,
        created_at TEXT
      )
      """
    )
    conn.commit()


def _record_audit(conn: sqlite3.Connection, action: str, detail: str) -> None:
  conn.execute(
    """
    INSERT INTO audit_log (uuid, action, detail, created_at)
    VALUES (?, ?, ?, ?)
    """,
    (_new_uuid(), action, detail, _now_iso()),
  )


def insert_note_rows(rows: Iterable[Dict[str, Any]], db_path: Path = DB_PATH) -> int:
  """Insert content-rank rows, return inserted count."""
  rows_list = list(rows)
  if not rows_list:
    return 0

  init_db_if_needed(db_path)
  created_at = _now_iso()
  payload = [
    (
      _new_uuid(),
      _normalize_value(r.get("title")),
      _normalize_value(r.get("nickname")),
      _normalize_value(r.get("publishTime") or r.get("publish_time")),
      _normalize_value(r.get("readCount") or r.get("read_count")),
      _normalize_value(r.get("clickRate") or r.get("click_rate")),
      _normalize_value(r.get("payConversionRate") or r.get("pay_conversion_rate")),
      _normalize_value(r.get("gmv")),
      _normalize_value(r.get("fetchDate") or r.get("fetch_date")),
      created_at,
    )
    for r in rows_list
  ]

  with sqlite3.connect(db_path) as conn:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.executemany(
      """
      INSERT INTO note_rank (
        uuid, title, nickname, publish_time,
        read_count, click_rate, pay_conversion_rate,
        gmv, fetch_date, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      payload,
    )
    _record_audit(
      conn,
      action="insert_note_rank",
      detail=f"inserted={len(payload)}",
    )
    conn.commit()
  return len(payload)


def insert_account_rows(
  rows: Iterable[Dict[str, Any]], db_path: Path = DB_PATH
) -> int:
  """Insert account-rank rows, return inserted count."""
  rows_list = list(rows)
  if not rows_list:
    return 0

  init_db_if_needed(db_path)
  created_at = _now_iso()
  payload = [
    (
      _new_uuid(),
      _normalize_value(r.get("shopName") or r.get("shop_name")),
      _normalize_value(r.get("fansCount") or r.get("fans_count")),
      _normalize_value(r.get("readCount") or r.get("read_count")),
      _normalize_value(r.get("clickRate") or r.get("click_rate")),
      _normalize_value(r.get("payConversionRate") or r.get("pay_conversion_rate")),
      _normalize_value(r.get("gmv")),
      _normalize_value(r.get("fetchDate") or r.get("fetch_date")),
      created_at,
    )
    for r in rows_list
  ]

  with sqlite3.connect(db_path) as conn:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.executemany(
      """
      INSERT INTO account_rank (
        uuid, shop_name, fans_count,
        read_count, click_rate, pay_conversion_rate,
        gmv, fetch_date, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      payload,
    )
    _record_audit(
      conn,
      action="insert_account_rank",
      detail=f"inserted={len(payload)}",
    )
    conn.commit()
  return len(payload)


def _paginate_and_total(conn: sqlite3.Connection, base_sql: str, params: Tuple[Any, ...], page: int, page_size: int) -> Tuple[List[sqlite3.Row], int]:
  """Execute paginated query and return rows plus total count."""
  offset = (page - 1) * page_size
  paginated_sql = base_sql + " LIMIT ? OFFSET ?"
  cursor = conn.execute(paginated_sql, params + (page_size, offset))
  rows = cursor.fetchall()
  total = conn.execute("SELECT COUNT(1) FROM (" + base_sql + ")", params).fetchone()[0]
  return rows, total


def list_note_rows(
  db_path: Path = DB_PATH,
  q: str | None = None,
  fetch_date_from: str | None = None,
  fetch_date_to: str | None = None,
  page: int = 1,
  page_size: int = 20,
) -> Tuple[List[Dict[str, Any]], int]:
  """List note_rank rows with simple filters and pagination."""
  init_db_if_needed(db_path)
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    filters = []
    params: Tuple[Any, ...] = tuple()

    base_sql = "SELECT * FROM note_rank WHERE 1=1"

    if q:
      filters.append(" AND (title LIKE ? OR nickname LIKE ?)")
      params += (f"%{q}%", f"%{q}%")
    if fetch_date_from:
      filters.append(" AND fetch_date >= ?")
      params += (fetch_date_from,)
    if fetch_date_to:
      filters.append(" AND fetch_date <= ?")
      params += (fetch_date_to,)

    order_sql = " ORDER BY fetch_date DESC, created_at DESC"
    base_sql += "".join(filters) + order_sql

    rows, total = _paginate_and_total(conn, base_sql, params, page, page_size)
    return [dict(r) for r in rows], total


def list_account_rows(
  db_path: Path = DB_PATH,
  q: str | None = None,
  fetch_date_from: str | None = None,
  fetch_date_to: str | None = None,
  page: int = 1,
  page_size: int = 20,
) -> Tuple[List[Dict[str, Any]], int]:
  """List account_rank rows with simple filters and pagination."""
  init_db_if_needed(db_path)
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    filters = []
    params: Tuple[Any, ...] = tuple()

    base_sql = "SELECT * FROM account_rank WHERE 1=1"

    if q:
      filters.append(" AND (shop_name LIKE ?)")
      params += (f"%{q}%",)
    if fetch_date_from:
      filters.append(" AND fetch_date >= ?")
      params += (fetch_date_from,)
    if fetch_date_to:
      filters.append(" AND fetch_date <= ?")
      params += (fetch_date_to,)

    order_sql = " ORDER BY fetch_date DESC, created_at DESC"
    base_sql += "".join(filters) + order_sql

    rows, total = _paginate_and_total(conn, base_sql, params, page, page_size)
    return [dict(r) for r in rows], total


def list_audit_logs(
  db_path: Path = DB_PATH,
  action: str | None = None,
  detail_q: str | None = None,
  created_from: str | None = None,
  created_to: str | None = None,
  page: int = 1,
  page_size: int = 20,
) -> Tuple[List[Dict[str, Any]], int]:
  """List audit_log rows with simple filters and pagination."""
  init_db_if_needed(db_path)
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    filters = []
    params: Tuple[Any, ...] = tuple()

    base_sql = "SELECT * FROM audit_log WHERE 1=1"

    if action:
      filters.append(" AND action = ?")
      params += (action,)
    if detail_q:
      filters.append(" AND detail LIKE ?")
      params += (f"%{detail_q}%",)
    if created_from:
      filters.append(" AND created_at >= ?")
      params += (created_from,)
    if created_to:
      filters.append(" AND created_at <= ?")
      params += (created_to,)

    order_sql = " ORDER BY created_at DESC"
    base_sql += "".join(filters) + order_sql

    rows, total = _paginate_and_total(conn, base_sql, params, page, page_size)
    return [dict(r) for r in rows], total
