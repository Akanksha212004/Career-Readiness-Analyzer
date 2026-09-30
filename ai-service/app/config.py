from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8000
    allowed_origins: str = "http://localhost:5000"
    semantic_model_name: str = "all-MiniLM-L6-v2"
    fuzzy_match_threshold: int = 85
    fuzzy_weight: float = 0.5

    # Optional personal access token (no scopes needed) used only to raise
    # the GitHub REST API rate limit for repo-link verification from 60/hr
    # (unauthenticated) to 5000/hr. Verification still works without one -
    # it just tolerates hitting the lower limit sooner (see github_verifier.py).
    github_token: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()


