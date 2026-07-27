from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import jwt
import datetime
from functools import wraps

# =========================================
# Flask App Configuration
# =========================================
app = Flask(__name__)
CORS(app)

# JWT Secret Key
app.config['SECRET_KEY'] = 'cyber-logs-secret-key-2024'

# =========================================
# PostgreSQL Config
# =========================================
DB_USER = "pguser"
DB_PASS = "pgpass123"
DB_HOST = "10.0.32.71"
DB_PORT = "5432"
DB_NAME = "postgres"

# =========================================
# Database Connection
# =========================================
def get_db_connection():
    try:
        print(f"DEBUG: Connecting to database...")
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        print(f"DEBUG: Database connection successful")
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

# =========================================
# Password Hashing
# =========================================
def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

# =========================================
# JWT Token Decorator
# =========================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Token is missing or invalid'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# =========================================
# Initialize Database Tables
# =========================================
def init_database():
    """Check existing users_login table structure"""
    conn = get_db_connection()
    if conn is None:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Check if users_login table exists and has correct structure
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users_login'
        """)
        
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        required_columns = ['id', 'username', 'password', 'display', 'role']
        
        if all(col in existing_columns for col in required_columns):
            print("Database table 'users_login' exists with correct structure")
            
            # Check if there are any users
            cursor.execute("SELECT COUNT(*) FROM users_login")
            user_count = cursor.fetchone()[0]
            
            print(f"Found {user_count} existing users in database")
            
            # Create suspicious table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS suspicious (
                    id SERIAL PRIMARY KEY,
                    suspic_ip TEXT,
                    abuse_confi INTEGER,
                    country TEXT,
                    domain_name TEXT,
                    total_report INTEGER,
                    last_report TEXT,
                    usage_type TEXT,
                    city TEXT,
                    ips TEXT,
                    hostname TEXT,
                    created_at DATE
                )
            """)
            conn.commit()
            print("Database table 'suspicious' created/verified successfully")
            
            cursor.close()
            conn.close()
            return True
        else:
            print("Database table 'users_login' has incorrect structure")
            print(f"Required columns: {required_columns}")
            print(f"Existing columns: {existing_columns}")
            cursor.close()
            conn.close()
            return False
        
    except Exception as e:
        print(f"Database initialization error: {e}")
        if conn:
            conn.close()
        return False

# =========================================
# API Routes
# =========================================

@app.route('/')
def home():
    return jsonify({
        'message': 'CYBER LOGS API Server',
        'version': '1.0.0',
        'status': 'running'
    })

@app.route('/api/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({
                'success': False,
                'message': 'Username and password are required'
            }), 400
        
        username = data['username'].strip()
        password = data['password'].strip()
        
        # Validate input
        if len(username) < 3:
            return jsonify({
                'success': False,
                'message': 'Username must be at least 3 characters'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 6 characters'
            }), 400
        
        conn = get_db_connection()
        if conn is None:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500
        
        cursor = conn.cursor()
        print(f"DEBUG: Attempting login for user: {username}")
        
        # Find user by username
        cursor.execute("""
            SELECT id, username, password, display, role
            FROM users_login 
            WHERE username = %s
        """, (username,))
        
        user = cursor.fetchone()
        
        print(f"DEBUG: User from DB: {user}")
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401
        
        # Verify password (check if stored password is hashed or plain text)
        stored_password = user[2]  # Tuple index: 0=id, 1=username, 2=password, 3=display, 4=role
        input_password = password
        
        # Check if stored password is already hashed (64 chars for SHA256)
        if len(stored_password) == 64 and all(c in '0123456789abcdef' for c in stored_password.lower()):
            # Stored password is hashed, compare with hash
            hashed_input_password = hash_password(input_password)
            password_match = hashed_input_password == stored_password
        else:
            # Stored password is plain text, compare directly
            password_match = input_password == stored_password
        
        if not password_match:
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401
        
        # Generate JWT token
        token = jwt.encode({
            'username': user[1],  # username
            'role': user[4],     # role
            'display_name': user[3],  # display
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': {
                'username': user[1],
                'display_name': user[3],
                'role': user[4]
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    """Get current user profile"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT id, username, display, role
            FROM users_login 
            WHERE username = %s
        """, (current_user,))
        
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'user': dict(user)
        })
        
    except Exception as e:
        print(f"Profile error: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/users', methods=['GET'])
@token_required
def get_users(current_user):
    """Get all users (admin only)"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if current user is admin
        cursor.execute("SELECT role FROM users_login WHERE username = %s", (current_user,))
        user_role = cursor.fetchone()
        
        if not user_role or user_role['role'] != 'admin':
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Access denied. Admin role required.'
            }), 403
        
        # Get all users
        cursor.execute("""
            SELECT id, username, display, role
            FROM users_login 
            ORDER BY id DESC
        """)
        
        users = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'users': [dict(user) for user in users]
        })
        
    except Exception as e:
        print(f"Users error: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/create-user', methods=['POST'])
@token_required
def create_user(current_user):
    """Create new user (admin only)"""
    try:
        # Check if current user is admin
        conn = get_db_connection()
        if conn is None:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT role FROM users_login WHERE username = %s", (current_user,))
        user_role = cursor.fetchone()
        
        if not user_role or user_role['role'] != 'admin':
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Access denied. Admin role required.'
            }), 403
        
        data = request.get_json()
        
        if not data or not all(k in data for k in ['username', 'password', 'display', 'role']):
            return jsonify({
                'success': False,
                'message': 'Username, password, display, and role are required'
            }), 400
        
        username = data['username'].strip()
        password = data['password'].strip()
        display_name = data['display'].strip()
        role = data['role'].strip()
        
        # Validate input
        if len(username) < 3:
            return jsonify({
                'success': False,
                'message': 'Username must be at least 3 characters'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 6 characters'
            }), 400
        
        if role not in ['admin', 'user']:
            return jsonify({
                'success': False,
                'message': 'Role must be either admin or user'
            }), 400
        
        # Check if username already exists
        cursor.execute("SELECT id FROM users_login WHERE username = %s", (username,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Username already exists'
            }), 400
        
        # Create new user
        hashed_password = hash_password(password)
        cursor.execute("""
            INSERT INTO users_login (username, password, display, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, username, display, role
        """, (username, hashed_password, display_name, role))
        
        new_user = cursor.fetchone()
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': dict(new_user)
        })
        
    except Exception as e:
        print(f"Create user error: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/logs_cyber', methods=['GET'])
@token_required
def get_logs_cyber(current_user):
    """Get cyber logs with optional date filter"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get query parameter
        target_date = request.args.get('date')
        
        if target_date:
            cursor.execute("""
                SELECT *
                FROM logs_cyber
                WHERE DATE(created_at) = %s
                ORDER BY created_at DESC, id DESC
            """, (target_date,))
        else:
            cursor.execute("""
                SELECT *
                FROM logs_cyber
                ORDER BY created_at DESC, id DESC
                LIMIT 1000
            """)
            
        logs = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert datetime objects to string for JSON serialization
        for log in logs:
            for key, value in log.items():
                if isinstance(value, datetime.datetime):
                    log[key] = value.isoformat()
                    
        return jsonify({
            'success': True,
            'data': [dict(log) for log in logs]
        })
        
    except Exception as e:
        print(f"Logs Cyber error: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/logs_dates', methods=['GET'])
@token_required
def get_logs_dates(current_user):
    """Get distinct dates that have logs"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({
                'success': False,
                'message': 'Database connection failed'
            }), 500
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT DISTINCT DATE(created_at) as log_date
            FROM logs_cyber
            ORDER BY log_date DESC
        """)
            
        dates = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert date objects to string for JSON serialization
        formatted_dates = []
        for row in dates:
            if row['log_date']:
                formatted_dates.append(row['log_date'].isoformat() if isinstance(row['log_date'], datetime.date) else str(row['log_date']))
                    
        return jsonify({
            'success': True,
            'dates': formatted_dates
        })
        
    except Exception as e:
        print(f"Logs Dates error: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

# =========================================
# Threat Intel Endpoints
# =========================================

INTERNAL_IP_PREFIXES = ['10.0.32.', '10.0.34.', '10.0.58.', '10.0.40.', '10.0.44.', '10.0.220.', '10.0.56.', '10.115.2.', '10.115.1.', '192.168.1.', '10.0.171.', '10.0.3.', '10.0.47.','10.115.3.']

def is_internal_ip_sql(field):
    """Returns SQL condition checking if field starts with internal prefixes."""
    conditions = [f"{field} LIKE '{prefix}%%'" for prefix in INTERNAL_IP_PREFIXES]
    return "(" + " OR ".join(conditions) + ")"

def is_external_ip_sql(field):
    """Returns SQL condition checking if field does not start with internal prefixes."""
    conditions = [f"{field} NOT LIKE '{prefix}%%'" for prefix in INTERNAL_IP_PREFIXES]
    return "(" + " AND ".join(conditions) + ")"

@app.route('/api/threat_intel_summary', methods=['GET'])
@token_required
def get_threat_intel_summary(current_user):
    try:
        target_date = request.args.get('date')
        if not target_date:
            return jsonify({'success': False, 'message': 'Missing date'}), 400
            
        conn = get_db_connection()
        if conn is None:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Overview
        overview_query = f"""
            SELECT COUNT(*) FROM logs_cyber 
            WHERE DATE(created_at) = %s 
            AND (
                ({is_external_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')})
                OR ({is_internal_ip_sql('source_ip')} AND {is_external_ip_sql('destination_ip')})
                OR ({is_internal_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')})
            )
        """
        cursor.execute(overview_query, (target_date,))
        overview_count = cursor.fetchone()['count']
        
        # 2. Inbound
        cursor.execute(f"SELECT COUNT(*) FROM logs_cyber WHERE DATE(created_at) = %s AND {is_external_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')}", (target_date,))
        inbound_count = cursor.fetchone()['count']
        
        # 3. Outbound
        cursor.execute(f"SELECT COUNT(*) FROM logs_cyber WHERE DATE(created_at) = %s AND {is_internal_ip_sql('source_ip')} AND {is_external_ip_sql('destination_ip')}", (target_date,))
        outbound_count = cursor.fetchone()['count']
        
        # 4. Internal
        cursor.execute(f"SELECT COUNT(*) FROM logs_cyber WHERE DATE(created_at) = %s AND {is_internal_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')}", (target_date,))
        internal_count = cursor.fetchone()['count']
        
        # 5. Suspicious
        suspicious_query = f"""
            SELECT COUNT(DISTINCT ip) as count FROM (
                SELECT source_ip as ip FROM logs_cyber 
                WHERE DATE(created_at) = %s AND {is_external_ip_sql('source_ip')}
                UNION
                SELECT destination_ip as ip FROM logs_cyber 
                WHERE DATE(created_at) = %s AND {is_external_ip_sql('destination_ip')}
            ) as combined_ips
            WHERE ip IS NOT NULL AND ip != ''
        """
        cursor.execute(suspicious_query, (target_date, target_date))
        suspicious_count = cursor.fetchone()['count']
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': [
                {'name': 'Overview', 'count': overview_count, 'key': 'overview'},
                {'name': 'Inbound Attack', 'count': inbound_count, 'key': 'inbound'},
                {'name': 'Outbound Attack', 'count': outbound_count, 'key': 'outbound'},
                {'name': 'Internal Attack', 'count': internal_count, 'key': 'internal'},
                {'name': 'Suspicious IP', 'count': suspicious_count, 'key': 'suspicious'},
            ]
        })
        
    except Exception as e:
        print(f"Threat Intel Summary error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/threat_intel_data', methods=['GET'])
@token_required
def get_threat_intel_data(current_user):
    """Get aggregated threat intel data based on type"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        target_date = request.args.get('date')
        report_type = request.args.get('type') # 'overview', 'inbound', 'outbound', 'internal'
        
        if not target_date or not report_type:
            return jsonify({'success': False, 'message': 'Missing date or type'}), 400
            
        base_query = """
            SELECT source_ip, severity, threat_subtype, destination_ip, COUNT(*) as count,
                   TO_CHAR(MAX(created_at), 'DD/MM/YYYY HH24:MI:SS') as created_at
            FROM logs_cyber
            WHERE DATE(created_at) = %s
        """
        
        conditions = ""
        if report_type == 'inbound':
            conditions = f" AND {is_external_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')}"
        elif report_type == 'outbound':
            conditions = f" AND {is_internal_ip_sql('source_ip')} AND {is_external_ip_sql('destination_ip')}"
        elif report_type == 'internal':
            conditions = f" AND {is_internal_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')}"
        elif report_type == 'overview':
            conditions = f""" AND (
                ({is_external_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')})
                OR ({is_internal_ip_sql('source_ip')} AND {is_external_ip_sql('destination_ip')})
                OR ({is_internal_ip_sql('source_ip')} AND {is_internal_ip_sql('destination_ip')})
            )"""
            
        group_by_query = """
            GROUP BY source_ip, severity, threat_subtype, destination_ip
            ORDER BY count DESC
        """
        
        full_query = base_query + conditions + group_by_query
        
        cursor.execute(full_query, (target_date,))
        data = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': [dict(row) for row in data]
        })
        
    except Exception as e:
        print(f"Threat Intel data error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/generate_suspicious_ips', methods=['POST'])
@token_required
def generate_suspicious_ips(current_user):
    """Extract external IPs from logs_cyber and insert into suspicious table for a date"""
    try:
        data = request.get_json()
        target_date = data.get('date')
        
        if not target_date:
            return jsonify({'success': False, 'message': 'Missing date'}), 400
            
        conn = get_db_connection()
        if conn is None:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Clear existing suspicious IPs for this date
        cursor.execute("DELETE FROM suspicious WHERE created_at = %s", (target_date,))
        
        # 2. Extract distinct external IPs from logs_cyber
        # Use UNION to get unique IPs from both source_ip and destination_ip
        extract_query = f"""
            SELECT DISTINCT ip FROM (
                SELECT source_ip as ip FROM logs_cyber 
                WHERE DATE(created_at) = %s AND {is_external_ip_sql('source_ip')}
                UNION
                SELECT destination_ip as ip FROM logs_cyber 
                WHERE DATE(created_at) = %s AND {is_external_ip_sql('destination_ip')}
            ) as combined_ips
            WHERE ip IS NOT NULL AND ip != ''
        """
        
        cursor.execute(extract_query, (target_date, target_date))
        external_ips = cursor.fetchall()
        
        # 3. Insert into suspicious table
        if external_ips:
            insert_query = """
                INSERT INTO suspicious (suspic_ip, created_at)
                VALUES (%s, %s)
            """
            for row in external_ips:
                cursor.execute(insert_query, (row['ip'], target_date))
                
        conn.commit()
        
        # 4. Fetch the newly inserted rows to return
        cursor.execute("""
            SELECT suspic_ip, abuse_confi, country, domain_name, total_report, 
                   last_report, usage_type, city, ips, hostname, created_at
            FROM suspicious
            WHERE created_at = %s
            ORDER BY id ASC
        """, (target_date,))
        
        inserted_data = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Format dates for JSON
        formatted_data = []
        for row in inserted_data:
            dict_row = dict(row)
            if dict_row.get('created_at'):
                dict_row['created_at'] = dict_row['created_at'].isoformat() if isinstance(dict_row['created_at'], datetime.date) else str(dict_row['created_at'])
            formatted_data.append(dict_row)
        
        return jsonify({
            'success': True,
            'message': f"Successfully generated {len(external_ips)} suspicious IPs for {target_date}",
            'data': formatted_data
        })
        
    except Exception as e:
        print(f"Generate suspicious IPs error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# =========================================
# Error Handlers
# =========================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'Internal server error'
    }), 500

# =========================================
# Main Application
# =========================================

if __name__ == '__main__':
    # Initialize database tables
    print("Initializing database...")
    if init_database():
        print("Database initialized successfully!")
        
        # Start Flask app
        print("Starting CYBER LOGS API Server...")
        print("Using existing database with current users:")
        print("  - T9058 (admin)")
        print("  - root (admin)")
        print("  - T9220 (admin)")
        print("  - admin (admin)")
        print("\nServer running on http://localhost:5107")
        
        app.run(
            host='0.0.0.0',
            port=5107,
            debug=True
        )
    else:
        print("Failed to initialize database!")
        exit(1)