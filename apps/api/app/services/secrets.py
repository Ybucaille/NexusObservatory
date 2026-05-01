import json
import os
from pathlib import Path
from typing import Protocol

from cryptography.fernet import Fernet, InvalidToken

from app import database

SERVICE_NAME = "nexus-observatory"
SECRET_REF_PREFIX = "nexus/custom-endpoints"


class SecretStoreError(RuntimeError):
    pass


class SecretStoreUnavailableError(SecretStoreError):
    pass


class SecretStore(Protocol):
    name: str

    def get_secret(self, secret_ref: str) -> str | None:
        pass

    def set_secret(self, secret_ref: str, value: str) -> None:
        pass

    def delete_secret(self, secret_ref: str) -> None:
        pass

    def has_secret(self, secret_ref: str) -> bool:
        pass


class KeyringSecretStore:
    name = "keyring"

    def __init__(self) -> None:
        try:
            import keyring  # type: ignore[import-not-found]
        except ImportError as exc:
            raise SecretStoreUnavailableError("Python keyring is not installed.") from exc

        self._keyring = keyring

    def get_secret(self, secret_ref: str) -> str | None:
        try:
            return self._keyring.get_password(SERVICE_NAME, secret_ref)
        except Exception as exc:
            raise SecretStoreError("Unable to read API key from keyring.") from exc

    def set_secret(self, secret_ref: str, value: str) -> None:
        try:
            self._keyring.set_password(SERVICE_NAME, secret_ref, value)
        except Exception as exc:
            raise SecretStoreError("Unable to store API key in keyring.") from exc

    def delete_secret(self, secret_ref: str) -> None:
        try:
            self._keyring.delete_password(SERVICE_NAME, secret_ref)
        except self._keyring.errors.PasswordDeleteError:
            return
        except Exception as exc:
            raise SecretStoreError("Unable to delete API key from keyring.") from exc

    def has_secret(self, secret_ref: str) -> bool:
        return self.get_secret(secret_ref) is not None


class EncryptedLocalSecretStore:
    name = "encrypted-local"

    def get_secret(self, secret_ref: str) -> str | None:
        encrypted_value = self._read().get(secret_ref)
        if encrypted_value is None:
            return None

        try:
            return self._fernet().decrypt(encrypted_value.encode("utf-8")).decode(
                "utf-8"
            )
        except (InvalidToken, UnicodeDecodeError) as exc:
            raise SecretStoreError(
                "Unable to decrypt local API key. The local secret key file may not match."
            ) from exc

    def set_secret(self, secret_ref: str, value: str) -> None:
        secrets = self._read()
        secrets[secret_ref] = self._fernet().encrypt(value.encode("utf-8")).decode(
            "utf-8"
        )
        self._write(secrets)

    def delete_secret(self, secret_ref: str) -> None:
        secrets = self._read()
        secrets.pop(secret_ref, None)
        self._write(secrets)

    def has_secret(self, secret_ref: str) -> bool:
        return secret_ref in self._read()

    def _secrets_path(self) -> Path:
        return database.DATABASE_PATH.parent / ".nexus_secrets.encrypted.json"

    def _key_path(self) -> Path:
        return database.DATABASE_PATH.parent / ".nexus_secret.key"

    def _fernet(self) -> Fernet:
        key_path = self._key_path()
        key_path.parent.mkdir(parents=True, exist_ok=True)
        if not key_path.exists():
            key_path.write_bytes(Fernet.generate_key())
            key_path.chmod(0o600)

        return Fernet(key_path.read_bytes())

    def _read(self) -> dict[str, str]:
        path = self._secrets_path()
        if not path.exists():
            return {}

        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SecretStoreError(
                "Encrypted local secret fallback file contains invalid JSON."
            ) from exc

        if not isinstance(parsed, dict):
            raise SecretStoreError(
                "Encrypted local secret fallback file must contain a JSON object."
            )

        return {
            key: value
            for key, value in parsed.items()
            if isinstance(key, str) and isinstance(value, str)
        }

    def _write(self, secrets: dict[str, str]) -> None:
        path = self._secrets_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(secrets, indent=2), encoding="utf-8")
        path.chmod(0o600)


class InsecureDevelopmentFileSecretStore:
    name = "insecure-development-file"

    def get_secret(self, secret_ref: str) -> str | None:
        return self._read().get(secret_ref)

    def set_secret(self, secret_ref: str, value: str) -> None:
        secrets = self._read()
        secrets[secret_ref] = value
        self._write(secrets)

    def delete_secret(self, secret_ref: str) -> None:
        secrets = self._read()
        secrets.pop(secret_ref, None)
        self._write(secrets)

    def has_secret(self, secret_ref: str) -> bool:
        return secret_ref in self._read()

    def _path(self) -> Path:
        return database.DATABASE_PATH.parent / ".nexus_secrets.local.json"

    def _read(self) -> dict[str, str]:
        path = self._path()
        if not path.exists():
            return {}

        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SecretStoreError(
                "Development secret fallback file contains invalid JSON."
            ) from exc

        if not isinstance(parsed, dict):
            raise SecretStoreError(
                "Development secret fallback file must contain a JSON object."
            )

        return {
            key: value
            for key, value in parsed.items()
            if isinstance(key, str) and isinstance(value, str)
        }

    def _write(self, secrets: dict[str, str]) -> None:
        path = self._path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(secrets, indent=2), encoding="utf-8")
        path.chmod(0o600)


def get_secret_store() -> SecretStore:
    requested_store = os.getenv("NEXUS_SECRET_STORE", "auto")
    if requested_store == "encrypted-local":
        return EncryptedLocalSecretStore()
    if requested_store == "insecure-development":
        if os.getenv("NEXUS_ALLOW_INSECURE_LOCAL_SECRETS") != "true":
            raise SecretStoreUnavailableError(
                "Set NEXUS_ALLOW_INSECURE_LOCAL_SECRETS=true to use the explicit "
                "insecure development secret fallback."
            )
        return InsecureDevelopmentFileSecretStore()
    if requested_store == "keyring":
        return KeyringSecretStore()

    try:
        return KeyringSecretStore()
    except SecretStoreUnavailableError:
        return EncryptedLocalSecretStore()


def build_endpoint_secret_ref(profile_id: str) -> str:
    return f"{SECRET_REF_PREFIX}/{profile_id}/api-key"
