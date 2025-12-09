import httpx
import json
from typing import Optional, Dict

# Firebase project configuration
FIREBASE_API_KEY = "AIzaSyBlOH9vbKxssHRppN0SJ0jYngVEvYq9z7w"
FIREBASE_PROJECT_ID = "taskerrandbeta"

async def verify_firebase_token(token: str) -> Optional[Dict]:
    """
    Verify Firebase ID token
    For development: Decodes JWT without verification
    For production: Use Firebase Admin SDK for proper verification
    """
    if not token:
        print("ERROR: No token provided")
        return None
    
    try:
        # Try to decode JWT token (development mode)
        # In production, use Firebase Admin SDK for proper verification
        import base64
        parts = token.split('.')
        if len(parts) != 3:
            print(f"ERROR: Invalid token format (expected 3 parts, got {len(parts)})")
            return None
            
        # Decode payload (without verification for dev)
        payload_str = parts[1]
        # Add padding if needed
        padding = len(payload_str) % 4
        if padding:
            payload_str += '=' * (4 - padding)
        
        try:
            decoded = base64.urlsafe_b64decode(payload_str)
            payload = json.loads(decoded)
        except Exception as decode_error:
            print(f"ERROR: Failed to decode token payload: {decode_error}")
            return None
        
        # Check if it's a Firebase token
        iss = payload.get("iss", "")
        if not iss or "firebase" not in str(iss):
            print(f"ERROR: Token is not from Firebase. ISS: {iss}")
            # Still try to use it if it has the required fields
            if not payload.get("user_id") and not payload.get("sub"):
                return None
        
        uid = payload.get("user_id") or payload.get("sub")
        if not uid:
            print("ERROR: Token missing user_id/sub")
            return None
        
        result = {
            "uid": uid,
            "email": payload.get("email", ""),
            "name": payload.get("name", ""),
            "picture": payload.get("picture", "")
        }
        
        print(f"DEBUG: Successfully decoded token for user: {result.get('email', 'unknown')}")
        return result
        
    except Exception as e:
        print(f"ERROR: Token decode error: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback: Try Firebase REST API verification
        try:
            print("DEBUG: Attempting Firebase API verification...")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}",
                    json={"idToken": token},
                    timeout=5.0
                )
                
                print(f"DEBUG: Firebase API response status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("users") and len(data["users"]) > 0:
                        user = data["users"][0]
                        result = {
                            "uid": user.get("localId"),
                            "email": user.get("email"),
                            "name": user.get("displayName"),
                            "picture": user.get("photoUrl")
                        }
                        print(f"DEBUG: Firebase API verification successful for: {result.get('email')}")
                        return result
                else:
                    print(f"ERROR: Firebase API returned status {response.status_code}: {response.text}")
        except Exception as e2:
            print(f"ERROR: Firebase API verification error: {e2}")
            import traceback
            traceback.print_exc()
    
    print("ERROR: All token verification methods failed")
    return None

async def get_current_user(token: str) -> Optional[Dict]:
    """Alias for verify_firebase_token"""
    return await verify_firebase_token(token)

