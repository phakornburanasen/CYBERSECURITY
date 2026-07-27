import psycopg2
import hashlib

# PostgreSQL Config
DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def debug_authentication():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        
        cursor = conn.cursor()
        
        # Test user data
        test_username = 'T9058'
        test_password = 'Th@nu1234'
        
        print(f"Testing authentication for user: {test_username}")
        print(f"Original password: {test_password}")
        print(f"Hashed password: {hash_password(test_password)}")
        
        # Get user from database
        cursor.execute("""
            SELECT id, username, password, display, role
            FROM users_login 
            WHERE username = %s
        """, (test_username,))
        
        user = cursor.fetchone()
        
        if user:
            print(f"\nDatabase user found:")
            print(f"  ID: {user[0]}")
            print(f"  Username: {user[1]}")
            print(f"  Stored Hash: {user[2]}")
            print(f"  Display: {user[3]}")
            print(f"  Role: {user[4]}")
            
            # Compare hashes
            stored_hash = user[2]
            input_hash = hash_password(test_password)
            
            print(f"\nHash comparison:")
            print(f"  Input hash:  {input_hash}")
            print(f"  Stored hash: {stored_hash}")
            print(f"  Match: {input_hash == stored_hash}")
            
            if input_hash == stored_hash:
                print("✓ Authentication should succeed!")
            else:
                print("✗ Authentication will fail!")
        else:
            print("✗ User not found in database")
        
        # Test all users
        print("\n" + "="*50)
        print("All users in database:")
        cursor.execute("SELECT id, username, display, role FROM users_login ORDER BY id")
        users = cursor.fetchall()
        
        for user in users:
            print(f"  ID {user[0]}: {user[1]} ({user[2]}) - {user[3]}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_authentication()
