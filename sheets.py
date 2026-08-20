import base64
import json
import os

import gspread
from storage import mark_records_exported

SPREADSHEET_NAME = "Daily Spending"

HEADERS = ["Amount", "Date", "Description"]


def _load_credentials_dict():
    env = os.environ.get("GOOGLE_CREDENTIALS_B64")
    if env:
        return json.loads(base64.b64decode(env))
    env = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if env:
        return json.loads(env)
    with open("credentials.json", "r", encoding="utf-8") as file:
        return json.load(file)


def connect_to_sheet():
    """
    Connects to Google Sheets and returns the first worksheet.
    Uses credentials.json by default, or GOOGLE_CREDENTIALS_B64 /
    GOOGLE_CREDENTIALS_JSON environment variables when deployed.
    """
    client = gspread.service_account_from_dict(_load_credentials_dict())
    spreadsheet = client.open(SPREADSHEET_NAME)
    return spreadsheet.sheet1


def _ensure_headers(sheet):
    if not sheet.get_all_values():
        sheet.append_row(HEADERS)


def load_records():
    """
    Returns all rows from the sheet as a list of dicts
    keyed by the header row.
    """
    sheet = connect_to_sheet()
    _ensure_headers(sheet)
    return sheet.get_all_records()


def export_records(records):
    """
    Exports a list of spending records to Google Sheets and marks
    them as exported so they are not sent again.
    """
    if not records:
        return

    sheet = connect_to_sheet()
    _ensure_headers(sheet)

    for record in records:
        sheet.append_row([
            record.get("amount", ""),
            f"{record.get('date', '')} {record.get('time', '')}".strip(),
            record.get("description", ""),
        ])

    mark_records_exported(records)