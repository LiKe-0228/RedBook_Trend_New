from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from flask import Flask, jsonify, request

from upload_to_feishu import upload_account_rows, upload_note_rows
import storage_sqlite

try:
    import config_local as _cfg  # type: ignore
except ImportError:  # pragma: no cover - 运行时检查
    _cfg = None  # type: ignore


API_PORT: int = getattr(_cfg, "API_PORT", 8000) if _cfg is not None else 8000
SQLITE_PATH: Path = Path(getattr(_cfg, "SQLITE_PATH", "data/xhs_rank.db"))

app = Flask(__name__)

# 初始化本地 SQLite（作为主数据仓库）
storage_sqlite.init_db_if_needed(SQLITE_PATH)


def _validate_rows(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        raise ValueError("请求体必须是 JSON 对象")

    rows = payload.get("rows")
    if rows is None:
        raise ValueError("缺少字段 rows")
    if not isinstance(rows, list):
        raise ValueError("rows 必须是数组")

    normalized: List[Dict[str, Any]] = []
    for idx, item in enumerate(rows):
        if not isinstance(item, dict):
            raise ValueError(f"rows[{idx}] 必须是对象")
        normalized.append(item)
    return normalized


def _parse_page(param: str | None, default: int = 1) -> int:
    try:
        value = int(param) if param is not None else default
        return max(1, value)
    except Exception:
        return default


def _parse_page_size(param: str | None, default: int = 20, max_size: int = 200) -> int:
    try:
        value = int(param) if param is not None else default
        value = max(1, value)
        return min(value, max_size)
    except Exception:
        return default


@app.after_request
def _add_cors_headers(response):
    # 允许来自网页（https://ark.xiaohongshu.com）和扩展的跨域访问本地接口
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    # 兼容 Chrome 私有网络访问限制
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.route("/upload_note_rank", methods=["POST", "OPTIONS"])
def upload_note_rank() -> Any:
    if request.method == "OPTIONS":
        # 预检请求，直接返回即可
        return ("", 204)
    try:
        payload = request.get_json(force=True, silent=False)  # type: ignore[assignment]
    except Exception:
        return jsonify({"ok": False, "error": "请求体不是合法 JSON"}), 400

    try:
        rows = _validate_rows(payload)  # type: ignore[arg-type]
        feishu_uploaded = upload_note_rows(rows)  # type: ignore[arg-type]
        return jsonify({"ok": True, "uploaded": feishu_uploaded})
    except Exception as exc:  # pragma: no cover - 主要用于运行时日志
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/upload_account_rank", methods=["POST", "OPTIONS"])
def upload_account_rank() -> Any:
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        payload = request.get_json(force=True, silent=False)  # type: ignore[assignment]
    except Exception:
        return jsonify({"ok": False, "error": "请求体不是合法 JSON"}), 400

    try:
        rows = _validate_rows(payload)  # type: ignore[arg-type]
        feishu_uploaded = upload_account_rows(rows)  # type: ignore[arg-type]
        return jsonify({"ok": True, "uploaded": feishu_uploaded})
    except Exception as exc:  # pragma: no cover - 主要用于运行时日志
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/db_only_note_rank", methods=["POST", "OPTIONS"])
def db_only_note_rank() -> Any:
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        payload = request.get_json(force=True, silent=False)  # type: ignore[assignment]
    except Exception:
        return jsonify({"ok": False, "error": "请求体不是合法 JSON"}), 400

    try:
        rows = _validate_rows(payload)  # type: ignore[arg-type]
        inserted = storage_sqlite.insert_note_rows(rows, SQLITE_PATH)
        return jsonify({"ok": True, "inserted": inserted})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/db_only_account_rank", methods=["POST", "OPTIONS"])
def db_only_account_rank() -> Any:
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        payload = request.get_json(force=True, silent=False)  # type: ignore[assignment]
    except Exception:
        return jsonify({"ok": False, "error": "请求体不是合法 JSON"}), 400

    try:
        rows = _validate_rows(payload)  # type: ignore[arg-type]
        inserted = storage_sqlite.insert_account_rows(rows, SQLITE_PATH)
        return jsonify({"ok": True, "inserted": inserted})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/note_rank", methods=["GET"])
def api_note_rank() -> Any:
    page = _parse_page(request.args.get("page"))
    page_size = _parse_page_size(request.args.get("page_size"))
    q = request.args.get("q") or None
    fetch_date_from = request.args.get("fetch_date_from") or None
    fetch_date_to = request.args.get("fetch_date_to") or None

    try:
        items, total = storage_sqlite.list_note_rows(
            SQLITE_PATH,
            q=q,
            fetch_date_from=fetch_date_from,
            fetch_date_to=fetch_date_to,
            page=page,
            page_size=page_size,
        )
        return jsonify({"ok": True, "data": {"items": items, "total": total}})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/account_rank", methods=["GET"])
def api_account_rank() -> Any:
    page = _parse_page(request.args.get("page"))
    page_size = _parse_page_size(request.args.get("page_size"))
    q = request.args.get("q") or None
    fetch_date_from = request.args.get("fetch_date_from") or None
    fetch_date_to = request.args.get("fetch_date_to") or None

    try:
        items, total = storage_sqlite.list_account_rows(
            SQLITE_PATH,
            q=q,
            fetch_date_from=fetch_date_from,
            fetch_date_to=fetch_date_to,
            page=page,
            page_size=page_size,
        )
        return jsonify({"ok": True, "data": {"items": items, "total": total}})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/audit_log", methods=["GET"])
def api_audit_log() -> Any:
    page = _parse_page(request.args.get("page"))
    page_size = _parse_page_size(request.args.get("page_size"))

    action = request.args.get("action") or None
    detail_q = request.args.get("detail_q") or None
    created_from = request.args.get("created_from") or None
    created_to = request.args.get("created_to") or None

    try:
        items, total = storage_sqlite.list_audit_logs(
            SQLITE_PATH,
            action=action,
            detail_q=detail_q,
            created_from=created_from,
            created_to=created_to,
            page=page,
            page_size=page_size,
        )
        return jsonify({"ok": True, "data": {"items": items, "total": total}})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/rank_change", methods=["GET"])
def api_rank_change() -> Any:
    view_type = request.args.get("type", "note").strip().lower()
    if view_type not in {"note", "account"}:
        return jsonify({"ok": False, "error": "type 参数必须为 note 或 account"}), 400

    try:
        if view_type == "note":
            current_date, previous_date, items = storage_sqlite.get_note_rank_changes(SQLITE_PATH)
        else:
            current_date, previous_date, items = storage_sqlite.get_account_rank_changes(SQLITE_PATH)

        return jsonify(
            {
                "ok": True,
                "data": {
                    "items": items,
                    "current_date": current_date,
                    "previous_date": previous_date,
                },
            }
        )
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    # 仅在本机使用，不开启对外访问
    app.run(host="127.0.0.1", port=API_PORT)
