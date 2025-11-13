# MatchiFy Backend - Quick Start Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

### 3. Start MongoDB
Make sure MongoDB is running on your system.

### 4. Run the Application
```bash
npm run start:dev
```

### 5. Access Swagger Documentation
Open your browser: **http://localhost:3000/api/docs**

---

## 📋 API Endpoints Summary

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/auth/signup/talent` | Register as talent | talent |
| POST | `/auth/signup/recruiter` | Register as recruiter | recruiter |
| POST | `/auth/login` | Login (both roles) | - |
| POST | `/auth/reset-password` | Reset password | - |

---

## 🎯 Key Features Implemented

✅ **Two separate signup endpoints**
- `/auth/signup/talent` - for talents with full profile
- `/auth/signup/recruiter` - for recruiters with basic info

✅ **MongoDB + Mongoose**
- User schema with both roles
- Email unique index
- Timestamps (createdAt, updatedAt)

✅ **Complete Validation**
- Email format validation
- Password minimum length (6 characters)
- Password confirmation matching
- All required fields validated

✅ **Security**
- Bcrypt password hashing (10 salt rounds)
- JWT token authentication
- Passwords never returned in responses

✅ **Swagger Documentation**
- Full API documentation at `/api/docs`
- All DTOs documented with examples
- Request/response schemas

✅ **MVVM Architecture**
- Models: MongoDB schemas (`user.schema.ts`)
- ViewModels: DTOs (all `*.dto.ts` files)
- Views: Controllers (`auth.controller.ts`)
- Business Logic: Services (`auth.service.ts`)

---

## 📦 File Structure Created/Updated

```
src/
├── auth/
│   ├── decorators/
│   │   └── match.decorator.ts          ✨ NEW - Password matching validator
│   ├── dto/
│   │   ├── talent-signup.dto.ts        ✨ NEW - Talent signup DTO
│   │   ├── recruiter-signup.dto.ts     ✨ NEW - Recruiter signup DTO
│   │   ├── login.dto.ts                📝 UPDATED - Added Swagger
│   │   ├── reset-password.dto.ts       📝 UPDATED - Added Swagger
│   │   └── signup.dto.ts               📝 UPDATED - Added Swagger
│   ├── auth.controller.ts              📝 UPDATED - Two new endpoints + Swagger
│   ├── auth.service.ts                 📝 UPDATED - signupTalent & signupRecruiter
│   └── auth.module.ts                  ✅ OK
├── user/
│   └── schemas/
│       └── user.schema.ts              📝 UPDATED - Added talent fields
├── main.ts                             📝 UPDATED - Swagger + validation
├── API_DOCUMENTATION.md                ✨ NEW - Complete API docs
└── .env.example                        ✨ NEW - Environment template
```

---

## 🧪 Test the Endpoints

### Talent Signup
```bash
curl -X POST http://localhost:3000/auth/signup/talent \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "test123",
    "confirmPassword": "test123",
    "phone": "+1234567890",
    "profileImage": "https://example.com/pic.jpg",
    "location": "New York",
    "talent": "Photographer"
  }'
```

### Recruiter Signup
```bash
curl -X POST http://localhost:3000/auth/signup/recruiter \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Smith",
    "email": "jane@company.com",
    "password": "test123",
    "confirmPassword": "test123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "test123"
  }'
```

---

## 📝 Expected Response Format

Both signup endpoints return:
```json
{
  "user": {
    "_id": "...",
    "fullName": "...",
    "email": "...",
    "role": "talent" | "recruiter",
    // ... other fields
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔐 JWT Token Payload

```json
{
  "id": "user_mongodb_id",
  "email": "user@example.com",
  "role": "talent" | "recruiter"
}
```

---

## 🛠️ Dependencies Added

- `@nestjs/swagger` - OpenAPI documentation
- `swagger-ui-express` - Swagger UI

All other dependencies were already present in your project.

---

## ✨ What's Different from Before

**Before:**
- Single `/auth/signup` endpoint
- Basic user schema
- No Swagger documentation
- No password confirmation validation

**After:**
- ✅ Separate endpoints for talents and recruiters
- ✅ Enhanced user schema with talent-specific fields
- ✅ Complete Swagger documentation
- ✅ Password confirmation with custom validator
- ✅ Global validation pipeline
- ✅ Better error messages and API responses
- ✅ Comprehensive API documentation

---

## 🎉 You're All Set!

Run `npm run start:dev` and visit:
- **App**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs

Happy coding! 🚀
