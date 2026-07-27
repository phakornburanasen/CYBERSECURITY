import psycopg2
from psycopg2.extras import RealDictCursor

DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

def check():
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check what dates we have
    cursor.execute("SELECT DISTINCT DATE(created_at) FROM logs_cyber LIMIT 5")
    print("Dates:", cursor.fetchall())
    
    # Pick the first date
    cursor.execute("SELECT DATE(created_at) FROM logs_cyber LIMIT 1")
    date = cursor.fetchone()
    if not date:
        print("No data")
        return
    date = date['date']
    
    prefixes = ['10.0.32.', '10.0.34.', '10.0.58.', '10.0.40.', '10.0.44.', '10.0.220.', '10.0.56.', '10.115.2.', '10.115.1.']
    def is_internal(f):
        return "(" + " OR ".join([f"{f} LIKE '{p}%'" for p in prefixes]) + ")"
    def is_external(f):
        return "(" + " AND ".join([f"{f} NOT LIKE '{p}%'" for p in prefixes]) + ")"
    
    queries = {
        'overview': f"SELECT source_ip, destination_ip, count(*) FROM logs_cyber WHERE DATE(created_at) = '{date}' GROUP BY source_ip, destination_ip ORDER BY count DESC LIMIT 3",
        'inbound': f"SELECT source_ip, destination_ip, count(*) FROM logs_cyber WHERE DATE(created_at) = '{date}' AND {is_external('source_ip')} AND {is_internal('destination_ip')} GROUP BY source_ip, destination_ip ORDER BY count DESC LIMIT 3",
        'outbound': f"SELECT source_ip, destination_ip, count(*) FROM logs_cyber WHERE DATE(created_at) = '{date}' AND {is_internal('source_ip')} AND {is_external('destination_ip')} GROUP BY source_ip, destination_ip ORDER BY count DESC LIMIT 3",
        'internal': f"SELECT source_ip, destination_ip, count(*) FROM logs_cyber WHERE DATE(created_at) = '{date}' AND {is_internal('source_ip')} AND {is_internal('destination_ip')} GROUP BY source_ip, destination_ip ORDER BY count DESC LIMIT 3",
    }
    
    for name, q in queries.items():
        cursor.execute(q)
        print(f"--- {name} ---")
        for row in cursor.fetchall():
            print(row)
        
check()
