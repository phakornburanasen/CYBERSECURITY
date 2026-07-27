import psycopg2

DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

try:
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS, port=DB_PORT)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'log_cyber'
    """)
    columns = cursor.fetchall()
    print("Table 'log_cyber' columns:")
    for col in columns:
        print(f"- {col[0]} ({col[1]})")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
