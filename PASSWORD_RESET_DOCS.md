# Password Reset Feature Documentation

## Overview

This document describes the 3-step password reset flow implemented in the MatchiFy backend.

## Flow Diagram

```
1. User Forgets Password
   ↓
2. Request Reset Code → Email sent with 6-digit code
   ↓
3. Verify Code → Code validated
   ↓
4. Reset Password → New password set
   ↓
5. Login with New Password
```

---

## API Endpoints

### 1. Request Password Reset Code

**POST** `/auth/password/forgot`

Request a 6-digit verification code to be sent via email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification code sent to your email",
  "expiresIn": "15 minutes"
}
```

**Error Responses:**
- `400` - No account found with this email address

**What Happens:**
1. System checks if email exists in database
2. Generates a random 6-digit code (e.g., "123456")
3. Saves code and expiration time (15 minutes) to user document
4. Sends email with the code via NodeMailer
5. Returns success message

---

### 2. Verify Reset Code

**POST** `/auth/password/verify`

Verify the 6-digit code received via email.

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200):**
```json
{
  "message": "Code verified successfully. You can now reset your password",
  "verified": true
}
```

**Error Responses:**
- `400` - Invalid verification code
- `400` - Verification code has expired. Please request a new one

**What Happens:**
1. System searches for user with matching reset code
2. Checks if code has expired (> 15 minutes old)
3. If valid, marks email as verified (sets `verifiedEmail` field)
4. Returns success message
5. User can now proceed to reset password

**Important:** This step must be completed before calling `/auth/password/reset`

---

### 3. Reset Password

**POST** `/auth/password/reset`

Set a new password after code verification.

**Request Body:**
```json
{
  "newPassword": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successful. Please log in with your new password."
}
```

**Error Responses:**
- `400` - Please verify your code first before resetting password
- `400` - Verification expired. Please request a new code
- `400` - Passwords do not match

**What Happens:**
1. System checks if user has recently verified their code (within 10 minutes)
2. Validates that `newPassword` matches `confirmPassword`
3. Hashes the new password with bcrypt
4. Updates user's password in database
5. Clears all reset-related fields (`resetCode`, `resetCodeExpiresAt`, `verifiedEmail`)
6. Returns success message
7. User can now login with new password

---

## Database Schema Changes

### User Schema Updates

```typescript
{
  // Existing fields...
  
  // Password reset fields
  resetCode?: string;              // 6-digit verification code
  resetCodeExpiresAt?: Date;       // Expiration timestamp
  verifiedEmail?: string;          // Email marked as verified after code check
  
  createdAt: Date;                 // Auto-generated
  updatedAt: Date;                 // Auto-generated
}
```

---

## Security Features

### 1. Code Expiration
- Verification codes expire after **15 minutes**
- Expired codes cannot be used
- User must request a new code if expired

### 2. Verification Window
- After code verification, user has **10 minutes** to reset password
- This prevents abuse of verified states
- If window expires, user must verify code again

### 3. Password Hashing
- All passwords are hashed using **bcrypt** with 10 salt rounds
- Raw passwords never stored in database

### 4. Single-Use Codes
- After password reset, all reset fields are cleared
- Code cannot be reused for another reset

### 5. Email Validation
- Only registered email addresses can request reset codes
- Email must exist in database

---

## Complete Flow Example

### Step 1: Request Code
```bash
curl -X POST http://localhost:3000/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

**Response:**
```json
{
  "message": "Verification code sent to your email",
  "expiresIn": "15 minutes"
}
```

**Email Received:**
```
Subject: Password Reset Verification Code

Password Reset Request

You requested to reset your password. Use the verification code below:

┌────────┐
│ 528394 │
└────────┘

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.
```

---

### Step 2: Verify Code
```bash
curl -X POST http://localhost:3000/auth/password/verify \
  -H "Content-Type: application/json" \
  -d '{
    "code": "528394"
  }'
```

**Response:**
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
    "newPassword": "MyNewPassword123",
    "confirmPassword": "MyNewPassword123"
  }'
```

**Response:**
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
    "email": "john@example.com",
    "password": "MyNewPassword123"
  }'
```

**Response:**
```json
{
  "user": {
    "_id": "...",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "talent",
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## DTOs (Data Transfer Objects)

### ForgotPasswordDto
```typescript
{
  email: string;  // Required, valid email format
}
```

### VerifyResetCodeDto
```typescript
{
  code: string;   // Required, exactly 6 digits
}
```

### ResetPasswordDto (New)
```typescript
{
  newPassword: string;      // Required, minimum 6 characters
  confirmPassword: string;  // Required, must match newPassword
}
```

---

## Email Configuration

The system uses the existing NodeMailer configuration from `.env`:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_FROM=your-email@gmail.com
```

**Note:** For Gmail, you need to use an **App Password**, not your regular password.

---

## Testing the Feature

### Test Case 1: Happy Path
1. ✅ Request code with valid email
2. ✅ Receive email with 6-digit code
3. ✅ Verify code successfully
4. ✅ Reset password with matching passwords
5. ✅ Login with new password

### Test Case 2: Invalid Email
1. ❌ Request code with non-existent email
2. Expected: `400 - No account found with this email address`

### Test Case 3: Invalid Code
1. ✅ Request code
2. ❌ Try to verify with wrong code
3. Expected: `400 - Invalid verification code`

### Test Case 4: Expired Code
1. ✅ Request code
2. ⏰ Wait more than 15 minutes
3. ❌ Try to verify code
4. Expected: `400 - Verification code has expired`

### Test Case 5: Reset Without Verification
1. ✅ Request code
2. ❌ Try to reset password without verifying
3. Expected: `400 - Please verify your code first`

### Test Case 6: Password Mismatch
1. ✅ Request code
2. ✅ Verify code
3. ❌ Try to reset with mismatched passwords
4. Expected: `400 - Passwords do not match`

---

## Architecture

### MVVM Pattern

**Models:**
- `User` schema in `src/user/schemas/user.schema.ts`

**ViewModels:**
- `ForgotPasswordDto` - Request DTO
- `VerifyResetCodeDto` - Verification DTO  
- `ResetPasswordDto` - Reset DTO

**Views:**
- `AuthController` - HTTP endpoints in `src/auth/auth.controller.ts`

**Services:**
- `AuthService` - Business logic in `src/auth/auth.service.ts`
- `EmailService` - Email sending in `src/common/services/email.service.ts`
- `UserService` - Database operations in `src/user/user.service.ts`

---

## Files Created/Modified

### New Files:
- ✨ `src/common/services/email.service.ts` - NodeMailer service
- ✨ `src/auth/dto/forgot-password.dto.ts` - Forgot password DTO
- ✨ `src/auth/dto/verify-reset-code.dto.ts` - Verify code DTO
- ✨ `src/auth/dto/reset-password-new.dto.ts` - Reset password DTO

### Modified Files:
- 📝 `src/user/schemas/user.schema.ts` - Added reset fields
- 📝 `src/user/user.service.ts` - Added helper methods
- 📝 `src/auth/auth.service.ts` - Added reset flow methods
- 📝 `src/auth/auth.controller.ts` - Added 3 new endpoints
- 📝 `src/auth/auth.module.ts` - Added EmailService provider

---

## Swagger Documentation

All endpoints are fully documented in Swagger UI at:
**http://localhost:3000/api/docs**

Each endpoint includes:
- ✅ Request body schema
- ✅ Response examples
- ✅ Error responses
- ✅ Descriptions
- ✅ Example values

---

## Production Considerations

### Current Implementation:
- Uses `verifiedEmail` field to track verification state
- 10-minute window after verification
- Works for single-user scenarios

### Recommended Improvements for Production:
1. **Use Redis** for temporary verification state
2. **Generate JWT tokens** after verification with short expiry
3. **Rate limiting** on forgot password endpoint (prevent abuse)
4. **IP tracking** for security monitoring
5. **Audit logging** for all password reset attempts
6. **Multi-factor authentication** option
7. **Account lockout** after multiple failed attempts

---

## Troubleshooting

### Email Not Received
- Check spam folder
- Verify MAIL_* variables in .env
- Ensure Gmail App Password is correct
- Check server logs for email errors

### Code Always Invalid
- Ensure code is exactly 6 digits
- Check if code has expired (> 15 minutes)
- Verify code was copied correctly (no spaces)

### Cannot Reset Password
- Ensure you verified the code first
- Check if more than 10 minutes passed since verification
- Try the complete flow again from step 1

---

## Support

For issues or questions, contact the development team.

**Last Updated:** November 13, 2025
