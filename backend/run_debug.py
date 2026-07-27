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

def test_login_logic():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        
        cursor = conn.cursor()
        
        # Test the exact same logic as app.py
        test_username = 'T9058'
        test_password = 'Th@nu1234'
        
        print(f"Testing login for: {test_username}")
        
        # Find user by username
        cursor.execute("""
            SELECT id, username, password, display, role
            FROM users_login 
            WHERE username = %s
        """, (test_username,))
        
        user = cursor.fetchone()
        
        if not user:
            print("✗ User not found")
            return False
        
        print(f"✓ User found: {user}")
        
        # Verify password (check if stored password is hashed or plain text)
        stored_password = user[2]
        input_password = test_password
        
        print(f"Stored password: '{stored_password}'")
        print(f"Input password: '{input_password}'")
        
        # Check if stored password is already hashed (64 chars for SHA256)
        if len(stored_password) == 64 and all(c in '0123456789abcdef' for c in stored_password.lower()):
            print("✓ Stored password appears to be hashed")
            # Stored password is hashed, compare with hash
            hashed_input_password = hash_password(input_password)
            password_match = hashed_input_password == stored_password
            print(f"Hashed input: {hashed_input_password}")
        else:
            print("✓ Stored password appears to be plain text")
            # Stored password is plain text, compare directly
            password_match = input_password == stored_password
        
        print(f"Password match: {password_match}")
        
        if password_match:
            print("✓ Authentication successful!")
        else:
            print("✗ Authentication failed!")
        
        cursor.close()
        conn.close()
        return password_match
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_login_logic()
