# FanScout - Athlete Trading Platform

## Setup Instructions

1. Install dependencies:
   ```bash
   npm run install-deps
   ```

2. Copy environment file and update with your values:
   ```bash
   cp backend/.env.example backend/.env
   ```
   
   **Important**: Update the JWT_SECRET in backend/.env with a secure random string

3. Start MongoDB (make sure it's running on localhost:27017)

4. Seed the database:
   ```bash
   npm run seed
   ```

5. Start the application:
   ```bash
   npm start
   ```

The app will be available at http://localhost:3000

## Security Notes

- Never commit your backend/.env file to version control
- Always use a strong, unique JWT_SECRET in production
- Update CORS_ORIGIN for your production domain
