# AI Job Hunter 🎯

An intelligent job application tracking and automation system that helps you discover, score, and apply to relevant job opportunities in the data science and energy sectors.

## Features

### 🔍 Smart Job Discovery
- Automated job scraping from multiple sources (LinkedIn, Indeed, Stepstone, Energy Jobline, DataCareer)
- Intelligent relevance scoring based on your skills and preferences
- Real-time job notifications via email
- Keyword-based filtering and matching

### 🤖 Auto-Apply System
- Learn from your manual applications to identify patterns
- Automatically apply to jobs matching your preferences
- Confidence scoring for application decisions
- Pattern-based job matching

### 📊 Analytics & Tracking
- Application statistics and success rates
- Application trend analysis over time
- Status tracking (pending, submitted, interview, rejected, accepted)
- Detailed application history

### 👤 User Profile Management
- Custom skill profiles
- Preferred job titles and locations
- Configurable relevance thresholds
- Auto-apply preferences

## Tech Stack

### Backend
- **Node.js** with **Express** server
- **tRPC** for type-safe API routes
- **Drizzle ORM** with MySQL database
- **Jose** for JWT authentication
- **Axios** for HTTP requests

### Frontend
- **React** with **Vite**
- **Tailwind CSS** for styling
- **SuperJSON** for data serialization
- Type-safe tRPC client

### Authentication
- OAuth 2.0 integration
- Session-based authentication with cookies
- JWT token verification

## Database Schema

The application uses MySQL with the following main tables:

- `users` - User accounts and authentication
- `user_profiles` - User preferences and settings
- `jobs` - Job listings from various sources
- `job_scores` - Relevance scores for each user/job pair
- `applications` - Application tracking
- `application_patterns` - Learned patterns from user behavior
- `search_filters` - Saved search preferences
- `email_notifications` - Notification history
- `refresh_logs` - Job refresh activity logs

## Environment Variables

Create a `.env` file in the root directory:

```env
# App Configuration
VITE_APP_ID=your_app_id
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=mysql://user:password@host:port/database

# Authentication
JWT_SECRET=your_jwt_secret
OAUTH_SERVER_URL=your_oauth_server_url
OWNER_OPEN_ID=your_owner_open_id

# Notifications
BUILT_IN_FORGE_API_URL=your_notification_api_url
BUILT_IN_FORGE_API_KEY=your_notification_api_key
```

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ai-job-hunter
```

2. Install dependencies:
```bash
npm install
```

3. Set up your database:
```bash
# Run database migrations
npm run db:push
```

4. Configure environment variables (see above)

5. Start the development server:
```bash
npm run dev
```

## Usage

### For Users

1. **Sign up/Login**: Authenticate using OAuth (Google, Microsoft, GitHub, etc.)

2. **Complete Your Profile**: 
   - Add your skills, experience, and preferences
   - Set your preferred job titles and locations
   - Configure notification email

3. **Browse Jobs**:
   - View automatically scored job listings
   - Filter by relevance score, location, and source
   - See matched keywords for each job

4. **Apply to Jobs**:
   - Apply manually with custom cover letters
   - Enable auto-apply for hands-free applications
   - Track application status

5. **Monitor Progress**:
   - View analytics dashboard
   - Track success rates
   - Review application history

### API Routes

All API routes are exposed via tRPC at `/api/trpc`:

- `auth.me` - Get current user
- `auth.logout` - Logout user
- `profile.get` - Get user profile
- `profile.update` - Update profile
- `jobs.list` - List jobs with scores
- `jobs.refresh` - Refresh job listings
- `applications.list` - List applications
- `applications.submitApplication` - Apply to a job
- `autoApply.getCandidates` - Get auto-apply candidates
- `autoApply.run` - Run auto-apply process
- `analytics.getOverview` - Get analytics overview

## Development

### Project Structure

```
├── client/              # Frontend React application
│   ├── src/
│   ├── public/
│   └── index.html
├── server/              # Backend Express server
│   ├── _core/          # Core server utilities
│   ├── routers.ts      # tRPC routers
│   ├── db.ts           # Database operations
│   └── services/       # Business logic
├── shared/             # Shared types and constants
├── drizzle/            # Database schema
└── vite.config.ts      # Vite configuration
```

### Running in Development

```bash
npm run dev
```

This starts both the Vite dev server and the Express backend.

### Building for Production

```bash
npm run build
npm start
```

## Key Algorithms

### Job Relevance Scoring

Jobs are scored based on:
- High priority keywords (10 points each): data scientist, machine learning, energy systems, etc.
- Medium priority keywords (5 points each): data analyst, automation, research, etc.
- Low priority keywords (2 points each): engineer, scientist, researcher, etc.
- User-specific skills (8 points each)

Scores are normalized to 0-100 range.

### Auto-Apply Pattern Matching

The system learns from manual applications and creates patterns based on:
- Matched keywords (40 points for 2+ matches)
- Company matches (30 points)
- Location matches (20 points)
- Text content matches (up to 30 points)

Jobs with 70%+ pattern confidence are auto-applied.

## Security Features

- HttpOnly cookies for session management
- CSRF protection with SameSite cookies
- Secure cookie transmission over HTTPS
- JWT token verification
- Role-based access control (user/admin)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub or contact the maintainer.

---

Built with ❤️ for data scientists seeking their next opportunity in the energy sector.
