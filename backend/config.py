from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    NETLAB_API_URL: str
    NETLAB_LOGIN: str
    NETLAB_PASSWORD: str
    BACKEND_URL: str

    YA_ID_KEY: str
    YA_API_KEY: str
    FOLDER_ID: str


settings = Settings()