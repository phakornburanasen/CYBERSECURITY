import requests
import json

# Simple test to debug the 500 error
def simple_test():
    try:
        print("Testing simple login...")
        
        # Test with minimal data
        login_data = {
            'username': 'T9058',
            'password': 'Th@nu1234'
        }
        
        print(f"Sending data: {json.dumps(login_data, indent=2)}")
        
        response = requests.post(
            'http://10.115.2.65:5000/api/login',
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Text: {response.text}")
        
        if response.status_code != 200:
            print(f"Error details: {response.status_code} - {response.reason}")
            
    except Exception as e:
        print(f"Test error: {e}")

if __name__ == "__main__":
    simple_test()
