import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(
    os.getenv("NEXUS_DATABASE_PATH", API_ROOT / "nexus_observatory.db")
)
OPENAI_COMPATIBLE_BASE_URL = os.getenv("OPENAI_COMPATIBLE_BASE_URL")
OPENAI_COMPATIBLE_API_KEY = os.getenv("OPENAI_COMPATIBLE_API_KEY")
OPENAI_COMPATIBLE_DEFAULT_MODEL = os.getenv(
    "OPENAI_COMPATIBLE_DEFAULT_MODEL",
    "openai-compatible-default",
)
