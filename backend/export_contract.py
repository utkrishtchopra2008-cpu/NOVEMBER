"""Regenerate contracts from actual FastAPI/Pydantic definitions; no credentials needed."""
import json
from pathlib import Path
from app.config import Settings
from app.demo import sample
from app.main import create_app

target = Path(__file__).resolve().parents[1] / 'shared'
target.mkdir(exist_ok=True)
app = create_app(Settings(_env_file=None, mode='demo', database_url='sqlite://'))
(target / 'openapi.json').write_text(json.dumps(app.openapi(), indent=2) + '\n')
(target / 'demo-intake.json').write_text(sample().model_dump_json(indent=2) + '\n')
