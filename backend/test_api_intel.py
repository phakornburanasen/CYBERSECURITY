import requests
import jwt
import datetime

SECRET_KEY = 'cyber-logs-secret-key-2024'
token = jwt.encode({
    'username': 'admin',
    'role': 'admin',
    'display_name': 'Admin',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
}, SECRET_KEY, algorithm='HS256')

headers = {'Authorization': f'Bearer {token}'}
date = '2026-05-19'
types = ['overview', 'inbound', 'outbound', 'internal']

for t in types:
    res = requests.get(f'http://localhost:5107/api/threat_intel_data?date={date}&type={t}', headers=headers)
    data = res.json()
    print(f"--- {t} ---")
    if data.get('success'):
        rows = data['data']
        print(f"Total rows: {len(rows)}")
        for r in rows[:2]:
            print(r)
    else:
        print("Error:", data)
