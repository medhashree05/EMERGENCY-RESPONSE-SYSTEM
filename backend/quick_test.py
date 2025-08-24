# quick_test.py
import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

# Test the exact connection parameters
connection_params = {
    'host': 'oetqicwymvsvzmronzsx.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'medhaers2005*',  # Use actual password, not URL encoded for direct connection
    'sslmode': 'require'
}

print("🔍 Testing direct psycopg2 connection...")
try:
    conn = psycopg2.connect(**connection_params)
    cur = conn.cursor()
    cur.execute('SELECT version()')
    version = cur.fetchone()
    print(f"✅ Connection successful!")
    print(f"PostgreSQL version: {version[0]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"❌ Direct connection failed: {e}")

print("\n🔍 Testing SQLAlchemy connection...")
from sqlalchemy import create_engine, text

# Try different connection string formats
connection_strings = [
    "postgresql://postgres:medhaers2005%2A@oetqicwymvsvzmronzsx.supabase.co:5432/postgres?sslmode=require",
    "postgresql://postgres:medhaers2005%2A@oetqicwymvsvzmronzsx.supabase.co:5432/postgres",
    f"postgresql://postgres:medhaers2005%2A@oetqicwymvsvzmronzsx.supabase.co/postgres?sslmode=require"
]

for i, conn_str in enumerate(connection_strings, 1):
    try:
        print(f"\n📡 Trying connection string {i}...")
        engine = create_engine(conn_str)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print(f"✅ Connection {i} successful!")
            print(f"Use this connection string: {conn_str}")
            break
    except Exception as e:
        print(f"❌ Connection {i} failed: {e}")