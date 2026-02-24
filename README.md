# Room Booking System - Local Setup Guide

This guide will help you set up and run the Room Booking System in your local development environment.

## Prerequisites

- **Node.js**: v18.x or higher
- **PostgreSQL**: A running PostgreSQL instance
- **npm**: Comes with Node.js

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/room_booking_db
SESSION_SECRET=your_random_secret_string
NODE_ENV=development
```

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Schema Setup**
   Push the schema to your local PostgreSQL database using Drizzle:
   ```bash
   npm run db:push
   ```

3. **Seed Initial Data (Optional)**
   If you want to create a default admin user and some rooms:
   ```bash
   # You can create a seed script or use the application's registration
   # Default admin credentials in the system are:
   # Email: admin@company.com
   # Password: admin123
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5000`.

## Features Included

- **Frontend**: React with Vite, Tailwind CSS, and Shadcn UI.
- **Backend**: Express.js server.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Passport.js with session-based auth.
- **Real-time**: Integrated meeting scheduler and analytics.

## Project Structure

- `client/`: Frontend React application.
- `server/`: Express backend and database logic.
- `shared/`: Shared types and database schemas.
