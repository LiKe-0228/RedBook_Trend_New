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


if __name__ == "__main__":
    # 仅在本机使用，不开启对外访问
    app.run(host="127.0.0.1", port=API_PORT)
