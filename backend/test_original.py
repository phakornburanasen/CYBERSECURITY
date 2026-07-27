import requests
import json

# Test original app.py
def test_original():
    try:
        print("Testing original app.py...")
        
        # Test with basic connection first
        response = requests.get('http://10.115.2.65:5000/', timeout=5)
        if response.status_code == 200:
            print("✓ Backend is accessible")
        else:
            print(f"✗ Backend not accessible: {response.status_code}")
            return
        
        # Test login with minimal data
        login_data = {
            'username': 'T9058',
            'password': 'Th@nu1234'
        }
        
        print(f"Sending login request...")
        response = requests.post(
            'http://10.115.2.65:5000/api/login',
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        try:
            data = response.json()
            print(f"Response Data: {json.dumps(data, indent=2)}")
        except:
            print(f"Response Text: {response.text}")
            
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    test_original()
