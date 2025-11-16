🚀 MatchiFy Backend (NestJS)

MatchiFy is a recruitment platform backend built with NestJS, designed for connecting unique talents (artists, freelancers, influencers, creators) with recruiters looking for creative professionals.

This backend includes a complete authentication system, separate signup flows, password reset system, JWT security, Swagger documentation, and follows an MVVM-style architecture.

⸻

📦 Features

🔐 Authentication System
	•	Separate signup endpoints:
	•	/auth/signup/talent
	•	/auth/signup/recruiter
	•	Secure login endpoint
	•	JWT authentication (7-day expiration)
	•	Password hashing using bcrypt
	•	Email uniqueness validation
	•	Global validation pipeline

🎭 Talent vs Recruiter Roles
	•	Talent users have a full profile (image, phone, location, talent type)
	•	Recruiters require only basic registration info
	•	Role automatically assigned based on endpoint

📧 Full Password Reset System

A secure 3-step flow:
	1.	Forgot Password → Send 6-digit verification code
/auth/password/forgot
	2.	Verify Code → Confirm email
/auth/password/verify
	3.	Reset Password → Set a new password
/auth/password/reset

Includes:
	•	Code expiration (15 minutes)
	•	Verification window (10 minutes)
	•	Invalid/expired code handling
	•	Complete email sending using NodeMailer

📚 Swagger Documentation

Full interactive API documentation available at:

➡️ http://localhost:3000/api/docs

Includes:
	•	All DTOs
	•	Response schemas
	•	Examples
	•	Validation rules

🧱 Architecture (MVVM-style)
	•	Models: Mongoose Schemas
	•	ViewModels: DTOs & validation
	•	Views: Controllers
	•	Business Logic: Services
🔌 API Endpoints

🧑‍🎨 Talent Signup

POST /auth/signup/talent

🧑‍💼 Recruiter Signup

POST /auth/signup/recruiter

🔑 Login

POST /auth/login

🔐 JWT Authentication
Expiration: 7 days
