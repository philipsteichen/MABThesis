from pathlib import Path

# Project root is one level up from backend/
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

FUTURES_PATH = PROJECT_ROOT / "z-archive" / "BarchartFutures" / "barchart_wednesdays.csv"
CASH_PATH = PROJECT_ROOT / "z-archive" / "Parcell_GrainPrices_August-2024.xlsx"
CASH_SHEET = "Parcell_GrainPrices_August_2024"
