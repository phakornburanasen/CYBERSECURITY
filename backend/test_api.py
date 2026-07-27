import requests
import json

# Test backend connection
def test_backend():
    try:
        print("Testing backend connection...")
        
        # Test 1: Basic connection
        response = requests.get('http://10.115.2.65:5000/', timeout=5)
        print(f"✓ Backend is running: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Test 2: Login endpoint with test data
        login_data = {
            'username': 'T9058',
            'password': 'Th@nu1234'
        }
        
        response = requests.post(
            'http://10.115.2.65:5000/api/login',
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        
        print(f"\n✓ Login endpoint status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Login successful: {data}")
        else:
            print(f"✗ Login failed: {response.text}")
            
    except requests.exceptions.ConnectionError as e:
        print(f"✗ Connection Error: {e}")
        print("Make sure backend is running on port 5000")
    except requests.exceptions.Timeout as e:
        print(f"✗ Timeout Error: {e}")
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_backend()
