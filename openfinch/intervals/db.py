import sqlite3
import pandas as pd
import datetime
import os
from pathlib import Path

# Database path at the root of the project
DB_PATH = Path(os.path.abspath(__file__)).parent.parent.parent / "openfinch_cache.db"

def init_db():
    """Initializes the SQLite database with necessary tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Metadata table to store last fetched timestamps
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metadata (
            symbol TEXT,
            interval TEXT,
            last_fetched TIMESTAMP,
            PRIMARY KEY (symbol, interval)
        )
    """)
    
    # Needs to store Dataframes with DatetimeIndex
    # price_data table: symbol, interval, timestamp (index), Open, High, Low, Close, Volume
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS price_data (
            symbol TEXT,
            interval TEXT,
            timestamp TIMESTAMP,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            PRIMARY KEY (symbol, interval, timestamp)
        )
    """)
    
    conn.commit()
    conn.close()

def should_fetch(symbol: str, interval: str) -> bool:
    """
    Determine if we should fetch new data based on the interval and last_fetched time.
    For simplicity:
    - Intraday intervals (< 1d): fetch if older than 15 minutes.
    - Daily+ intervals (>= 1d): fetch if older than 12 hours.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT last_fetched FROM metadata WHERE symbol=? AND interval=?", (symbol, interval))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return True
    
    last_fetched = datetime.datetime.fromisoformat(row[0])
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Handle timezone differences if last_fetched is naive
    if last_fetched.tzinfo is None:
        last_fetched = last_fetched.replace(tzinfo=datetime.timezone.utc)
    
    diff = now - last_fetched
    
    is_intraday = interval.endswith("m") or interval.endswith("h")
    
    if is_intraday:
        # Fetch if older than 15 minutes
        return diff.total_seconds() > 15 * 60
    else:
        # Fetch if older than 12 hours
        return diff.total_seconds() > 12 * 3600

def update_metadata(symbol: str, interval: str):
    """Update the last_fetched timestamp for a symbol and interval."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("""
        INSERT OR REPLACE INTO metadata (symbol, interval, last_fetched)
        VALUES (?, ?, ?)
    """, (symbol, interval, now))
    conn.commit()
    conn.close()

def save_data(symbol: str, interval: str, df: pd.DataFrame):
    """
    Save new yfinance DataFrame to the sqlite database.
    Uses INSERT OR REPLACE to update existing timestamps.
    """
    if df.empty:
        return

    # Create a copy so we don't mutate the original df's index
    df_to_save = df.copy()
    
    # yfinance indices are datetime, sometimes with timezone.
    # We will ensure they are UTC and save as string representation.
    if df_to_save.index.tz is not None:
        df_to_save.index = df_to_save.index.tz_convert('UTC')
    else:
        df_to_save.index = df_to_save.index.tz_localize('UTC')

    # Add symbol and interval columns for the database schema
    df_to_save['symbol'] = symbol
    df_to_save['interval'] = interval
    df_to_save['timestamp'] = df_to_save.index.astype(str)
    
    # Rename columns to match db schema
    df_to_save = df_to_save.rename(columns={
        'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume'
    })
    
    df_to_save = df_to_save[['symbol', 'interval', 'timestamp', 'open', 'high', 'low', 'close', 'volume']]
    
    conn = sqlite3.connect(DB_PATH)
    
    # Using to_sql with 'append' will fail if primary key exists. 
    # Therefore, we use a custom executemany with INSERT OR REPLACE.
    cursor = conn.cursor()
    
    records = list(df_to_save.itertuples(index=False, name=None))

    cursor.executemany("""
        INSERT OR REPLACE INTO price_data (symbol, interval, timestamp, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, records)
    
    conn.commit()
    conn.close()
    
    # Update last_fetched
    update_metadata(symbol, interval)

def get_cached_data(symbol: str, interval: str) -> pd.DataFrame:
    """
    Retrieve all cached data from the sqlite database for a given symbol and interval.
    Returns a DataFrame with a DatetimeIndex resembling yfinance output.
    """
    conn = sqlite3.connect(DB_PATH)
    
    query = """
    SELECT timestamp, open as Open, high as High, low as Low, close as Close, volume as Volume
    FROM price_data
    WHERE symbol=? AND interval=?
    ORDER BY timestamp ASC
    """
    
    df = pd.read_sql_query(query, conn, params=(symbol, interval))
    conn.close()
    
    if df.empty:
        return df

    # Convert timestamp back to DatetimeIndex
    # yfinance uses localized datetime index, usually 'America/New_York' or 'UTC'. Let's standardise to UTC.
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        
    # Convert volume to float to match original logic if it isn't
    df['Volume'] = df['Volume'].astype(float)
    
    df.set_index('timestamp', inplace=True)
    df.index.name = 'Date' # standard yfinance name
    
    return df
