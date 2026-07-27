import psycopg2

# PostgreSQL Config
DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

def check_table_structure():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        
        cursor = conn.cursor()
        
        # Check if users_login table exists
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'users_login'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        
        if columns:
            print("Existing users_login table structure:")
            for col in columns:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  - {col[0]}: {col[1]}{max_len}")
        else:
            print("users_login table does not exist")
        
        # Check existing data
        cursor.execute("SELECT * FROM users_login LIMIT 5")
        rows = cursor.fetchall()
        
        if rows:
            print("\nExisting data:")
            for row in rows:
                print(f"  {row}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_table_structure()
