import gspread
from storage import mark_records_exported

SPREADSHEET_NAME = "Daily Spending"

HEADERS = ["Amount", "Date", "Description"]


def connect_to_sheet():
    """
    Connects to Google Sheets and returns the first worksheet.
    """
    client = gspread.service_account(filename="credentials.json")
    spreadsheet = client.open(SPREADSHEET_NAME)
    return spreadsheet.sheet1


def _ensure_headers(sheet):
    if not sheet.get_all_values():
        sheet.append_row(HEADERS)


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
