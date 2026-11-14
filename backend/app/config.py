from typing import Literal
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    mode: Literal['demo', 'live'] = 'demo'
    database_url: str = 'sqlite:///./vulnflow-demo.db'
    cors_origins: list[str] = ['http://localhost:5173']
    supabase_url: str = ''
    supabase_publishable_key: str = ''
    github_token: str = ''
    prune_api_key: str = ''
    llm_model: str = ''
    max_body_bytes: int = 350000

    @model_validator(mode='after')
    def live_config(self):
        if self.mode == 'live':
            if not self.database_url.startswith('postgresql+psycopg://'):
                raise ValueError('Live mode requires Supabase Postgres DATABASE_URL')
            if not self.supabase_url.startswith('https://') or not all((self.supabase_publishable_key, self.prune_api_key, self.llm_model)):
                raise ValueError('Live mode requires Supabase HTTPS URL, publishable key, Prune key and LLM model')
            if '*' in self.cors_origins:
                raise ValueError('Live CORS must use explicit frontend origins')
        return self
