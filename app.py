import os
from datetime import datetime

from flask import Flask, redirect, render_template, request, url_for

from sheets import HEADERS, connect_to_sheet

app = Flask(__name__)


def _ensure_headers(sheet):
    if not sheet.get_all_values():
        sheet.append_row(HEADERS)


@app.route("/")
def index():
    sheet = connect_to_sheet()
    _ensure_headers(sheet)
    records = sheet.get_all_records()
    return render_template("index.html", records=records[-50:])


@app.route("/add", methods=["POST"])
def add_spending():
    amount = request.form.get("amount")
    description = request.form.get("description", "").strip()

    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return redirect(url_for("index"))

    if amount <= 0:
        return redirect(url_for("index"))

    sheet = connect_to_sheet()
    _ensure_headers(sheet)
    sheet.append_row([
        amount,
        datetime.now().strftime("%Y-%m-%d %H:%M"),
        description,
    ])
    return redirect(url_for("index"))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)