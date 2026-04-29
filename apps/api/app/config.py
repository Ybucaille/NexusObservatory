import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(
    os.getenv("NEXUS_DATABASE_PATH", API_ROOT / "nexus_observatory.db")
)
