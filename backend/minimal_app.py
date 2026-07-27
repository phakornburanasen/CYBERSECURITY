from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2

# PostgreSQL Config
DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

app = Flask(__name__)
CORS(app)

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

@app.route('/')
def home():
    return jsonify({
        'message': 'CYBER LOGS API Server',
        'status': 'running'
    })

@app.route('/api/login', methods=['POST'])
def login():
    try:
        print("DEBUG: Login endpoint called")
        
        data = request.get_json()
        print(f"DEBUG: Received data: {data}")
        
        if not data:
            print("DEBUG: No data received")
            return jsonify({'success': False, 'message': 'No data received'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        print(f"DEBUG: Username: '{username}', Password: '{password}'")
        
        conn = get_db_connection()
        if conn is None:
            print("DEBUG: Database connection failed")
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, username, password, display, role FROM users_login WHERE username = %s", (username,))
        user = cursor.fetchone()
        
        print(f"DEBUG: User from DB: {user}")
        
        if not user:
            print("DEBUG: User not found")
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': 'User not found'}), 401
        
        # Simple password comparison (plain text)
        if password != user[2]:
            print("DEBUG: Password mismatch")
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid password'}), 401
        
        print("DEBUG: Authentication successful")
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'username': user[1],
                'display_name': user[3],
                'role': user[4]
            }
        })
        
    except Exception as e:
        print(f"DEBUG: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

if __name__ == '__main__':
    print("Starting minimal app...")
    app.run(host='0.0.0.0', port=5000, debug=True)
