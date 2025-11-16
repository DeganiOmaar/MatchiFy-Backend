# MatchiFy Backend - Authentication API

## Overview

This is a NestJS backend implementation for a recruitment platform with separate signup endpoints for **Talents** and **Recruiters**. The application follows an MVVM-style architecture and includes complete Swagger documentation.

## Architecture

### MVVM Pattern
- **Models**: MongoDB schemas (Mongoose) - `src/user/schemas/user.schema.ts`
- **ViewModels**: DTOs and response objects - `src/auth/dto/`
- **Views**: Controllers (HTTP layer) - `src/auth/auth.controller.ts`
- **Business Logic**: Services - `src/auth/auth.service.ts`

## Tech Stack

- **Framework**: NestJS
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Password Hashing**: bcrypt

## Features

✅ Separate signup endpoints for talents and recruiters  
✅ MongoDB with Mongoose integration  
✅ Email uniqueness validation  
✅ Password confirmation matching  
✅ Bcrypt password hashing  
✅ JWT token generation  
✅ Comprehensive Swagger documentation  
✅ Role-based user management  
✅ Global validation pipes  

## API Endpoints

### Authentication

#### 1. Talent Signup
**POST** `/auth/signup/talent`

Register a new talent user with profile details and skills.

**Request Body:**
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

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "role": "talent",
    "phone": "+1234567890",
    "profileImage": "https://example.com/profile.jpg",
    "location": "New York, USA",
    "talent": "Photographer",
    "createdAt": "2025-11-13T10:00:00.000Z",
    "updatedAt": "2025-11-13T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 2. Recruiter Signup
**POST** `/auth/signup/recruiter`

Register a new recruiter user.

**Request Body:**
```json
{
  "fullName": "Jane Smith",
  "email": "jane.smith@company.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439012",
    "fullName": "Jane Smith",
    "email": "jane.smith@company.com",
    "role": "recruiter",
    "createdAt": "2025-11-13T10:00:00.000Z",
    "updatedAt": "2025-11-13T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. Login
**POST** `/auth/login`

Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

#### 4. Reset Password
**POST** `/auth/reset-password`

Reset user password by email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "newPassword": "NewSecurePass123"
}
```

## Database Schema

### User Model

```typescript
{
  fullName: string;          // Required
  email: string;             // Required, Unique, Indexed
  password: string;          // Required, Hashed with bcrypt
  role: 'talent' | 'recruiter';  // Required
  phone?: string;            // Optional
  profileImage?: string;     // Optional
  bannerImage?: string;      // Optional
  location?: string;         // Optional (talent-specific)
  talent?: string;           // Optional (talent-specific skill)
  createdAt: Date;           // Auto-generated
  updatedAt: Date;           // Auto-generated
}
```

## Validation Rules

### Talent Signup
- ✅ `fullName`: Required, non-empty string
- ✅ `email`: Required, valid email format, unique in database
- ✅ `password`: Required, minimum 6 characters
- ✅ `confirmPassword`: Required, must match password
- ✅ `phone`: Required, non-empty string
- ✅ `profileImage`: Required, non-empty string
- ✅ `location`: Required, non-empty string
- ✅ `talent`: Required, non-empty string

### Recruiter Signup
- ✅ `fullName`: Required, non-empty string
- ✅ `email`: Required, valid email format, unique in database
- ✅ `password`: Required, minimum 6 characters
- ✅ `confirmPassword`: Required, must match password

## JWT Token

The JWT token payload includes:
```typescript
{
  id: string;      // User MongoDB _id
  email: string;   // User email
  role: string;    // User role ('talent' or 'recruiter')
}
```

Default expiration: **7 days** (configurable via `JWT_EXPIRES` env variable)

## Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/matchify

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES=7d

# Server
PORT=3000
```

## Installation

```bash
# Install dependencies
npm install

# Start MongoDB (if running locally)
# Make sure MongoDB is running on your system

# Run the application in development mode
npm run start:dev
```

## Accessing Swagger Documentation

Once the application is running, visit:

🔗 **http://localhost:3000/api/docs**

The Swagger UI provides:
- Interactive API testing
- Complete endpoint documentation
- Request/response schemas
- Authentication flows

## Project Structure

```
src/
├── auth/
│   ├── decorators/
│   │   └── match.decorator.ts          # Custom password matching validator
│   ├── dto/
│   │   ├── login.dto.ts                # Login DTO with Swagger
│   │   ├── reset-password.dto.ts       # Reset password DTO with Swagger
│   │   ├── signup.dto.ts               # Legacy signup DTO
│   │   ├── talent-signup.dto.ts        # Talent signup DTO
│   │   └── recruiter-signup.dto.ts     # Recruiter signup DTO
│   ├── auth.controller.ts              # Auth endpoints with Swagger docs
│   ├── auth.service.ts                 # Auth business logic
│   ├── auth.module.ts                  # Auth module configuration
│   ├── jwt.strategy.ts                 # JWT strategy for Passport
│   ├── jwt-auth.guard.ts               # JWT authentication guard
│   ├── roles.decorator.ts              # Roles decorator
│   └── roles.guard.ts                  # Roles authorization guard
├── user/
│   ├── schemas/
│   │   └── user.schema.ts              # MongoDB User schema
│   ├── user.controller.ts              # User endpoints
│   ├── user.service.ts                 # User business logic
│   └── user.module.ts                  # User module
└── main.ts                             # Application bootstrap with Swagger

```

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt (salt rounds: 10)
2. **Email Uniqueness**: MongoDB unique index on email field
3. **Password Confirmation**: Custom validator ensures password and confirmPassword match
4. **Input Validation**: Global validation pipe with whitelist and transformation
5. **JWT Authentication**: Secure token-based authentication
6. **Role-Based Access**: User roles stored and validated

## Testing the API

### Using cURL

**Talent Signup:**
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

**Recruiter Signup:**
```bash
curl -X POST http://localhost:3000/auth/signup/recruiter \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Smith",
    "email": "jane.smith@company.com",
    "password": "SecurePass123",
    "confirmPassword": "SecurePass123"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123"
  }'
```

## Error Handling

The API returns appropriate HTTP status codes:

- **200**: Success
- **201**: Created (signup/registration)
- **400**: Bad Request (validation errors, duplicate email)
- **401**: Unauthorized (invalid credentials)
- **404**: Not Found
- **500**: Internal Server Error

## Future Enhancements

- [ ] Email verification
- [ ] Forgot password with email reset link
- [ ] Refresh token mechanism
- [ ] Rate limiting
- [ ] File upload for profile images
- [ ] Social authentication (Google, LinkedIn)
- [ ] Two-factor authentication (2FA)

## License

UNLICENSED

---

Built with ❤️ using NestJS
