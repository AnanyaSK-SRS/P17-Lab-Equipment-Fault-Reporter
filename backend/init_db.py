"""Standalone SQLite Database Initialization Script."""

from database import DEFAULT_DB_PATH, init_db


if __name__ == "__main__":
    init_db(DEFAULT_DB_PATH, seed=True)
    print(f"Initialized SQLite database at {DEFAULT_DB_PATH}")
