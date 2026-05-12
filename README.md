# ScribbleUp

A full-stack blog platform where users can write, publish, and manage blog posts.

Built with Node.js, Express, EJS, and PostgreSQL.

 **Live Demo:** [scribbleup-0s2n.onrender.com](https://scribbleup-0s2n.onrender.com)

---

## Features

- **Authentication** — Email/password login with bcrypt hashing, plus Google OAuth 2.0 (Sign in with Google)
- **Role-based access control** — Three roles: `author`, `editor`, and `admin`, each with appropriate permissions
- **Session management** — Persistent sessions stored in PostgreSQL via `connect-pg-simple`
- **Server-rendered UI** — EJS templating with reusable partials (header, footer)
- **Responsive design** — Mobile-friendly layout with CSS media queries
- **Method override** — PATCH and DELETE support from HTML forms

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express 5 |
| Templating | EJS |
| Database | PostgreSQL (`pg`) |
| Auth | Passport.js (Local + Google OAuth 2.0) |
| Sessions | express-session + connect-pg-simple |
| Password hashing | bcrypt |
| Deployment | Render |

---

## Getting Started

### Prerequisites
- Node.js v22+
- PostgreSQL

### Installation

```bash
git clone https://github.com/your-username/scribbleup.git
cd scribbleup
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NODE_ENV=development
```

### Run

```bash
node index.js
```

App runs on [http://localhost:3000](http://localhost:3000)

---

## Database Schema

You'll need the following tables: `users`, `blog`, `oauth_accounts`, and `session`.

> The `session` table is auto-created by `connect-pg-simple` if it doesn't exist.

---

## Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Home — list all blogs |
| GET | `/register` | Registration page |
| POST | `/register` | Create new user |
| GET | `/login` | Login page |
| POST | `/login` | Authenticate user |
| POST | `/logout` | Log out |
| GET | `/create` | New blog form (auth required) |
| POST | `/submit` | Create blog post |
| GET | `/blog/:id` | View a blog post |
| GET | `/blog/:id/edit` | Edit form (owner/editor/admin) |
| PATCH | `/blog/:id` | Update blog post |
| DELETE | `/blog/:id` | Delete blog post |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |

---

## Project Structure

```
├── index.js              # Server, routes, and Passport config
├── views/
│   ├── home.ejs
│   ├── create.ejs
│   ├── edit.ejs
│   ├── file.ejs
│   ├── login.ejs
│   ├── register.ejs
│   └── partials/
│       ├── header.ejs
│       └── footer.ejs
├── public/
│   ├── styles/
│   │   ├── style1.css
│   │   ├── style2.css
│   │   └── style3.css
│   └── img/
│       └── google.svg
├── test/
│   └── loadtest.js       # k6 load test script
├── .env                  # (ignored)
└── package.json
```

---

## License

ISC
