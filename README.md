# 🎯 AI Job Hunter

An intelligent job application tracking and automation system that helps you discover, score, and apply to relevant job opportunities.

## ✨ Features

### 🔍 Smart Job Discovery

- Automated job aggregation from multiple sources (LinkedIn, Indeed, Stepstone, Energy Jobline, DataCareer)
- Intelligent relevance scoring based on your skills and preferences
- Real-time job notifications via email
- Keyword-based filtering and matching

### 🤖 Auto-Apply System

- Learns from your manual applications to identify patterns
- Automatically applies to jobs matching your preferences
- Confidence scoring for application decisions
- Pattern-based job matching

### 📊 Analytics and Tracking

- Application statistics and success rates
- Application trend analysis over time
- Status tracking (pending, submitted, interview, rejected, accepted)
- Detailed application history

### 👤 User Profile Management

- Custom skill profiles
- Preferred job titles and locations
- Configurable relevance thresholds
- Auto-apply preferences

## 🛠️ Tech Stack

### Backend

- Node.js with Express
- tRPC for type-safe API routes
- Drizzle ORM with MySQL
- Jose for JWT authentication

### Frontend

- React with Vite
- Tailwind CSS
- SuperJSON for data serialization
- Type-safe tRPC client

### Authentication

- OAuth 2.0 integration
- Session-based authentication with cookies
- JWT token verification

## 🗄️ Database Schema

The application uses MySQL with the following tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts and authentication |
| `user_profiles` | User preferences and settings |
| `jobs` | Job listings from various sources |
| `job_scores` | Relevance scores for each user/job pair |
| `applications` | Application tracking |
| `application_patterns` | Learned patterns from user behavior |
| `search_filters` | Saved search preferences |
| `email_notifications` | Notification history |
| `refresh_logs` | Job refresh activity logs |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MySQL database

### Installation

1. Clone the repository:

```bash
git clone https://github.com/SauravBhowmick/ai-job-hunter.git
cd ai-job-hunter
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env` file in the root directory (see `.env.example` for reference).

4. Run database migrations:

```bash
pnpm db:push
```

5. Start the development server:

```bash
pnpm dev
```

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_APP_ID` | Application identifier |
| `NODE_ENV` | Environment (development/production) |
| `PORT` | Server port (default: 3000) |
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `OAUTH_SERVER_URL` | OAuth provider URL |
| `OWNER_OPEN_ID` | Owner's OpenID identifier |
| `BUILT_IN_FORGE_API_URL` | Notification API URL |
| `BUILT_IN_FORGE_API_KEY` | Notification API key |

## 📖 Usage

### Setting Up Your Profile

1. Sign up or log in using OAuth (Google, Microsoft, GitHub, etc.)
2. Complete your profile with skills, experience, and preferences
3. Set your preferred job titles and locations
4. Configure your notification email

### Browsing and Applying

1. View automatically scored job listings
2. Filter by relevance score, location, and source
3. Apply manually with custom cover letters, or enable auto-apply
4. Track your application status through the dashboard

### Monitoring Progress

- View analytics dashboard for success rates
- Review application history
- Track trends over time

## 🔌 API Routes

All routes are exposed via tRPC at `/api/trpc`:

| Route | Description |
|-------|-------------|
| `auth.me` | Get current user |
| `auth.logout` | Log out user |
| `profile.get` | Get user profile |
| `profile.update` | Update profile |
| `jobs.list` | List jobs with scores |
| `jobs.refresh` | Refresh job listings |
| `applications.list` | List applications |
| `applications.submitApplication` | Apply to a job |
| `autoApply.getCandidates` | Get auto-apply candidates |
| `autoApply.run` | Run auto-apply process |
| `analytics.getOverview` | Get analytics overview |

## 📁 Project Structure

```
ai-job-hunter/
├── client/                 # Frontend React application
│   ├── src/
│   ├── public/
│   └── index.html
├── server/                 # Backend Express server
│   ├── _core/             # Core server utilities
│   ├── routers.ts         # tRPC routers
│   ├── db.ts              # Database operations
│   └── services/          # Business logic
├── shared/                # Shared types and constants
├── drizzle/               # Database schema and migrations
├── patches/               # Package patches
├── drizzle.config.ts      # Drizzle configuration
├── vite.config.ts         # Vite configuration
└── vitest.config.ts       # Vitest configuration
```

## 🧠 How It Works

### Job Relevance Scoring

Jobs are scored based on keyword matching:

| Priority | Points | Examples |
|----------|--------|----------|
| 🔴 High | 10 | data scientist, machine learning, energy systems |
| 🟡 Medium | 5 | data analyst, automation, research |
| 🟢 Low | 2 | engineer, scientist, researcher |
| 🔵 User skills | 8 | Based on your profile |

Scores are normalized to a 0 to 100 range.

### Auto-Apply Pattern Matching

The system learns from your manual applications:

| Factor | Points |
|--------|--------|
| Matched keywords (2+) | 40 |
| Company match | 30 |
| Location match | 20 |
| Text content match | Up to 30 |

Jobs with 70% or higher pattern confidence are auto-applied.

## 🔒 Security

- HttpOnly cookies for session management
- CSRF protection with SameSite cookies
- Secure cookie transmission over HTTPS
- JWT token verification
- Role-based access control (user/admin)

## ☁️ Deployment

The project includes configuration for both Railway and Vercel:

| Platform | Config File |
|----------|-------------|
| Railway | `railway.json` |
| Vercel | `vercel.json` |

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Pull request process
- Style guidelines

### Quick Start

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool aggregates job listings from various sources. Please ensure your use complies with the terms of service of each platform. The developers are not responsible for any misuse of this software.

## 💬 Support

For issues and questions, please [open an issue](https://github.com/SauravBhowmick/ai-job-hunter/issues) on GitHub.

## 🙏 Acknowledgments

- Thanks to all contributors who help improve this project
- Built for data scientists and professionals seeking opportunities in the energy sector

