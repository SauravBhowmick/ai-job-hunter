# 🤝 Contributing to AI Job Hunter

Thank you for your interest in contributing to AI Job Hunter! This document provides guidelines and instructions for contributing.

## 📑 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [How to Contribute](#-how-to-contribute)
- [Development Setup](#-development-setup)
- [Pull Request Process](#-pull-request-process)
- [Style Guidelines](#-style-guidelines)
- [Reporting Bugs](#-reporting-bugs)
- [Suggesting Features](#-suggesting-features)

## 📜 Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- ✅ Be respectful and considerate in all interactions
- ✅ Welcome newcomers and help them get started
- ✅ Accept constructive criticism gracefully
- ✅ Focus on what is best for the community and project

## 🚀 Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a new branch for your contribution
5. Make your changes
6. Submit a pull request

## 💡 How to Contribute

There are many ways to contribute:

| Type | Description |
|------|-------------|
| 🐛 Bug Reports | Report issues you encounter |
| ✨ Feature Requests | Suggest new functionality |
| 💻 Code | Submit bug fixes or new features |
| 📝 Documentation | Improve or add documentation |
| 🧪 Testing | Add or improve tests |
| 👀 Reviews | Review pull requests from others |

## 🛠️ Development Setup

### Prerequisites

- Node.js 18 or higher
- pnpm package manager
- MySQL database
- Git

### Installation

1. Fork and clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/ai-job-hunter.git
cd ai-job-hunter
```

2. Add the upstream remote:

```bash
git remote add upstream https://github.com/SauravBhowmick/ai-job-hunter.git
```

3. Install dependencies:

```bash
pnpm install
```

4. Copy the environment file and configure it:

```bash
cp .env.example .env
```

5. Set up the database:

```bash
pnpm db:push
```

6. Start the development server:

```bash
pnpm dev
```

### 🧪 Running Tests

```bash
pnpm test
```

## 📤 Pull Request Process

### ✅ Before Submitting

1. Ensure your code follows the style guidelines
2. Update documentation if needed
3. Add tests for new functionality
4. Run the test suite and ensure all tests pass
5. Keep commits focused and atomic

### 📝 Submitting a Pull Request

1. Update your fork with the latest upstream changes:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

2. Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

3. Make your changes and commit them:

```bash
git add .
git commit -m "Add: brief description of changes"
```

4. Push to your fork:

```bash
git push origin feature/your-feature-name
```

5. Open a pull request on GitHub

### 💬 Commit Message Format

Use clear, descriptive commit messages:

| Prefix | Usage |
|--------|-------|
| `Add:` | New feature or file |
| `Fix:` | Bug fix |
| `Update:` | Update existing functionality |
| `Remove:` | Remove code or files |
| `Refactor:` | Code refactoring |
| `Docs:` | Documentation changes |
| `Test:` | Adding or updating tests |

Examples:
- `Add: email notification service`
- `Fix: job scoring calculation error`
- `Docs: update installation instructions`

### 📋 Pull Request Template

When opening a PR, please include:

- A clear title describing the change
- A description of what the PR does
- Any related issue numbers
- Screenshots (if applicable)
- Testing steps

## 🎨 Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Define types explicitly where possible
- Avoid using `any` type
- Use interfaces for object shapes

### Code Formatting

The project uses Prettier for code formatting. Run before committing:

```bash
pnpm format
```

Configuration is in `.prettierrc`.

### 📛 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `jobScore` |
| Functions | camelCase | `calculateScore()` |
| Classes | PascalCase | `JobService` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Files | kebab-case | `job-service.ts` |
| Database tables | snake_case | `user_profiles` |

### 📁 Project Structure

- Place React components in `client/src/components/`
- Place API routes in `server/routers/`
- Place shared types in `shared/`
- Place database operations in `server/db.ts`

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. A clear, descriptive title
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots (if applicable)
6. Environment details:
   - Operating system
   - Node.js version
   - Browser (if frontend issue)

### 📝 Bug Report Template

```markdown
**Description**
A clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g., Windows 11, macOS 14]
- Node.js: [e.g., 18.17.0]
- Browser: [e.g., Chrome 120]
```

## ✨ Suggesting Features

Feature suggestions are welcome! Please include:

1. A clear description of the feature
2. The problem it solves
3. Potential implementation approach (optional)
4. Any alternatives you considered

### 📝 Feature Request Template

```markdown
**Problem**
Describe the problem this feature would solve.

**Proposed Solution**
Describe your proposed feature.

**Alternatives**
Any alternative solutions you considered.

**Additional Context**
Any other relevant information.
```

## ❓ Questions?

If you have questions about contributing, feel free to:

- 🎫 Open an issue with the `question` label
- 💬 Start a discussion in the Discussions tab

---

🙏 Thank you for contributing to AI Job Hunter!
