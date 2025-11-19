from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

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
