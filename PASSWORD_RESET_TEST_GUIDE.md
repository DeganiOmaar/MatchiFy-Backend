# Password Reset - Quick Test Guide

## Prerequisites
1. Server running: `npm run start:dev`
2. MongoDB connected
3. Email configured in `.env`
4. At least one user registered

---

## Test Scenario: Complete Password Reset Flow

### Setup: Create a Test User
```bash
curl -X POST http://localhost:3000/auth/signup/talent \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "oldpass123",
    "confirmPassword": "oldpass123",
    "phone": "+1234567890",
    "profileImage": "https://example.com/pic.jpg",
    "location": "Test City",
    "talent": "Tester"
  }'
```

---

### Step 1: Request Reset Code
```bash
curl -X POST http://localhost:3000/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response:**
```json
{
  "message": "Verification code sent to your email",
  "expiresIn": "15 minutes"
}
```

**Action:** Check email inbox for 6-digit code

---

### Step 2: Verify Code
```bash
curl -X POST http://localhost:3000/auth/password/verify \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
```
*(Replace "123456" with actual code from email)*

**Expected Response:**
```json
{
  "message": "Code verified successfully. You can now reset your password",
  "verified": true
}
```

---

### Step 3: Reset Password
```bash
curl -X POST http://localhost:3000/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "newpass123",
    "confirmPassword": "newpass123"
  }'
```

**Expected Response:**
```json
{
  "message": "Password reset successful. Please log in with your new password."
}
```

---

### Step 4: Login with New Password
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "newpass123"
  }'
```

**Expected Response:**
```json
{
  "user": { ... },
  "token": "eyJhbGc..."
}
```

---

## Test Using Swagger UI

1. Open: http://localhost:3000/api/docs
2. Navigate to **auth** section
3. Test endpoints in order:
   - POST /auth/password/forgot
   - POST /auth/password/verify
   - POST /auth/password/reset
   - POST /auth/login

---

## Error Testing

### Test Invalid Email
```bash
curl -X POST http://localhost:3000/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com"
  }'
```
**Expected:** `400 - No account found with this email address`

---

### Test Invalid Code
```bash
curl -X POST http://localhost:3000/auth/password/verify \
  -H "Content-Type: application/json" \
  -d '{
    "code": "000000"
  }'
```
**Expected:** `400 - Invalid verification code`

---

### Test Password Mismatch
```bash
curl -X POST http://localhost:3000/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "pass123",
    "confirmPassword": "pass456"
  }'
```
**Expected:** `400 - Passwords do not match`

---

### Test Reset Without Verification
```bash
# Skip step 2 (verification) and go directly to reset
curl -X POST http://localhost:3000/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "newpass123",
    "confirmPassword": "newpass123"
  }'
```
**Expected:** `400 - Please verify your code first before resetting password`

---

## Checklist

- [ ] Email received with 6-digit code
- [ ] Code can be verified successfully
- [ ] Password can be reset after verification
- [ ] Can login with new password
- [ ] Cannot login with old password
- [ ] Invalid email returns error
- [ ] Invalid code returns error
- [ ] Mismatched passwords return error
- [ ] Cannot reset without verification
- [ ] Code expires after 15 minutes

---

## Notes

- Each test should be independent
- Clear reset fields between tests if needed
- Check server logs for detailed error messages
- Swagger UI is recommended for easier testing

---

## Gmail App Password Setup

If using Gmail and emails aren't sending:

1. Enable 2-Factor Authentication on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate a new app password
4. Use this password in `.env` for `MAIL_PASS`
5. Format: `xxxx xxxx xxxx xxxx` (spaces included)

---

**Happy Testing! 🎉**
