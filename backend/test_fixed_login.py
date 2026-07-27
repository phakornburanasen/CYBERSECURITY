import requests
import json

# Test the fixed login
def test_login():
    try:
        print("Testing fixed login...")
        
        # Test with correct credentials
        login_data = {
            'username': 'T9058',
            'password': 'Th@nu1234'
        }
        
        print(f"Sending: {json.dumps(login_data, indent=2)}")
        
        response = requests.post(
            'http://10.115.2.65:5000/api/login',
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✓ Login successful!")
                print(f"User: {data.get('user')}")
                print(f"Token: {data.get('token')[:50]}...")
            else:
                print(f"✗ Login failed: {data.get('message')}")
        else:
            print(f"✗ HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"Test error: {e}")

if __name__ == "__main__":
    test_login()
