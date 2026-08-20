import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent
FILE_PATH = BASE_DIR / "data.json"


def _signature(record):
    return (
        record.get("date"),
        record.get("time"),
        record.get("amount"),
        record.get("description"),
    )


def _read_records():
    if FILE_PATH.exists():
        with open(FILE_PATH, "r", encoding="utf-8") as file:
            return json.load(file)
    return []


def _write_records(records):
    fd, temp_path = tempfile.mkstemp(dir=BASE_DIR, prefix="data-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(records, file, indent=2)
        os.replace(temp_path, FILE_PATH)
    except BaseException:
        os.unlink(temp_path)
        raise


def load_records():
    return [r for r in _read_records() if not r.get("exported", False)]


def save_record(amount, description):
    records = _read_records()

    now = datetime.now()
    record = {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "amount": amount,
        "description": description,
        "exported": False,
    }

    records.append(record)
    _write_records(records)


def mark_records_exported(records):
    exported = {_signature(r) for r in records}
    all_records = _read_records()

    for record in all_records:
        if not record.get("exported", False) and _signature(record) in exported:
            record["exported"] = True

    _write_records(all_records)
