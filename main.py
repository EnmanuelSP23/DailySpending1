from storage import save_record, load_records
from sheets import export_records


def main():
    running = True

    while running:
        print("\n1. Add spending")
        print("2. Export to Google Sheets")
        print("3. Exit")

        choice = input("Choose an option: ")

        if choice == "1":
            amount = input("Enter spending amount: ")

            try:
                amount = float(amount)
                if amount <= 0:
                    print("Amount must be positive")
                    continue
            except ValueError:
                print("Invalid number")
                continue

            description = input("Enter description: ").strip()

            save_record(amount, description)
            print("Saved")

        elif choice == "2":
            records = load_records()
            if not records:
                print("No new records to export")
                continue

            try:
                export_records(records)
                print(f"Export complete ({len(records)} records)")
            except Exception as e:
                print(f"Export failed: {e}")

        elif choice == "3":
            running = False

        else:
            print("Invalid option")


if __name__ == "__main__":
    main()
