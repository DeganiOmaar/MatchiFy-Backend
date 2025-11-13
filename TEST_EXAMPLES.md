# API Testing Examples

## Using Postman or Insomnia

### 1. Talent Signup

**Endpoint:** `POST http://localhost:3000/auth/signup/talent`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123",
  "phone": "+1234567890",
  "profileImage": "https://example.com/profile.jpg",
  "location": "New York, USA",
  "talent": "Photographer"
}
```

**Expected Response (201):**
```json
{
  "user": {
    "_id": "673ab2c3e8f9a1234567890a",
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "role": "talent",
    "phone": "+1234567890",
    "profileImage": "https://example.com/profile.jpg",
    "location": "New York, USA",
    "talent": "Photographer",
    "createdAt": "2025-11-13T12:30:45.123Z",
    "updatedAt": "2025-11-13T12:30:45.123Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3M2FiMmMzZThmOWExMjM0NTY3ODkwYSIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJyb2xlIjoidGFsZW50IiwiaWF0IjoxNzMxNTA0NjQ1LCJleHAiOjE3MzIxMDk0NDV9.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
}
```

---

### 2. Recruiter Signup

**Endpoint:** `POST http://localhost:3000/auth/signup/recruiter`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "fullName": "Jane Smith",
  "email": "jane.smith@company.com",
  "password": "SecurePass456",
  "confirmPassword": "SecurePass456"
}
```

**Expected Response (201):**
```json
{
  "user": {
    "_id": "673ab2c3e8f9a1234567890b",
    "fullName": "Jane Smith",
    "email": "jane.smith@company.com",
    "role": "recruiter",
    "createdAt": "2025-11-13T12:35:22.456Z",
    "updatedAt": "2025-11-13T12:35:22.456Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3M2FiMmMzZThmOWExMjM0NTY3ODkwYiIsImVtYWlsIjoiamFuZS5zbWl0aEBjb21wYW55LmNvbSIsInJvbGUiOiJyZWNydWl0ZXIiLCJpYXQiOjE3MzE1MDQ5MjIsImV4cCI6MTczMjEwOTcyMn0.XyZaBcDeFgHiJkLmNoPqRsTuVwXy1234567890"
}
```

---

### 3. Login

**Endpoint:** `POST http://localhost:3000/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123"
}
```

**Expected Response (200):**
```json
{
  "user": {
    "_id": "673ab2c3e8f9a1234567890a",
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "role": "talent",
    "phone": "+1234567890",
    "profileImage": "https://example.com/profile.jpg",
    "location": "New York, USA",
    "talent": "Photographer",
    "createdAt": "2025-11-13T12:30:45.123Z",
    "updatedAt": "2025-11-13T12:30:45.123Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 4. Reset Password

**Endpoint:** `POST http://localhost:3000/auth/reset-password`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "john.doe@example.com",
  "newPassword": "NewSecurePass789"
}
```

**Expected Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

## Error Responses

### 400 - Email Already Exists
```json
{
  "statusCode": 400,
  "message": "Email already exists",
  "error": "Bad Request"
}
```

### 400 - Validation Failed (Password Mismatch)
```json
{
  "statusCode": 400,
  "message": [
    "Passwords do not match"
  ],
  "error": "Bad Request"
}
```

### 400 - Validation Failed (Invalid Email)
```json
{
  "statusCode": 400,
  "message": [
    "Please provide a valid email address"
  ],
  "error": "Bad Request"
}
```

### 400 - Validation Failed (Password Too Short)
```json
{
  "statusCode": 400,
  "message": [
    "Password must be at least 6 characters long"
  ],
  "error": "Bad Request"
}
```

### 401 - Invalid Credentials
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

---

## Testing with cURL

### Talent Signup
```bash
curl -X POST http://localhost:3000/auth/signup/talent \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123",
    "confirmPassword": "SecurePass123",
    "phone": "+1234567890",
    "profileImage": "https://example.com/profile.jpg",
    "location": "New York, USA",
    "talent": "Photographer"
  }'
```

### Recruiter Signup
```bash
curl -X POST http://localhost:3000/auth/signup/recruiter \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Smith",
    "email": "jane.smith@company.com",
    "password": "SecurePass456",
    "confirmPassword": "SecurePass456"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123"
  }'
```

### Reset Password
```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "newPassword": "NewSecurePass789"
  }'
```

---

## Testing Protected Routes (with JWT)

If you have protected routes that require authentication:

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Example:**
```bash
curl -X GET http://localhost:3000/some-protected-route \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

## Validation Test Cases

### Test 1: Password Mismatch
```json
{
  "fullName": "Test User",
  "email": "test@example.com",
  "password": "password123",
  "confirmPassword": "password456"
}
```
**Expected:** 400 Bad Request - "Passwords do not match"

### Test 2: Invalid Email Format
```json
{
  "fullName": "Test User",
  "email": "invalid-email",
  "password": "password123",
  "confirmPassword": "password123"
}
```
**Expected:** 400 Bad Request - "Please provide a valid email address"

### Test 3: Password Too Short
```json
{
  "fullName": "Test User",
  "email": "test@example.com",
  "password": "12345",
  "confirmPassword": "12345"
}
```
**Expected:** 400 Bad Request - "Password must be at least 6 characters long"

### Test 4: Missing Required Fields
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
**Expected:** 400 Bad Request - Multiple validation errors for missing fields

---

## Notes

1. **JWT Token**: Save the token from signup/login response for authenticated requests
2. **Token Expiration**: Default is 7 days (configurable via JWT_EXPIRES)
3. **Password Security**: Passwords are hashed with bcrypt and never returned in responses
4. **Email Uniqueness**: Each email can only be registered once
5. **Role Assignment**: Roles are automatically assigned based on the signup endpoint used
