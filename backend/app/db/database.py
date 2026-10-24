"""Small SQLite-backed persistence for GoSolar's demo application records."""
import json
import os
from pathlib import Path
import sqlite3
from threading import RLock
from contextlib import contextmanager
from collections.abc import Iterator

_lock = RLock()
_default_path = Path(__file__).resolve().parents[2] / "gosolar.sqlite3"


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    path = Path(os.getenv("GOSOLAR_DATABASE_PATH", str(_default_path)))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    try:
        connection.execute("CREATE TABLE IF NOT EXISTS applications (tracking_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def save_application(record: dict) -> None:
    with _lock, _connect() as connection:
        connection.execute(
            "INSERT INTO applications (tracking_id, payload) VALUES (?, ?) ON CONFLICT(tracking_id) DO UPDATE SET payload=excluded.payload",
            (record["tracking_id"], json.dumps(record)),
        )


def get_application(tracking_id: str) -> dict | None:
    with _lock, _connect() as connection:
        row = connection.execute("SELECT payload FROM applications WHERE tracking_id = ?", (tracking_id,)).fetchone()
    return json.loads(row[0]) if row else None
