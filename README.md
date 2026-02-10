# ScribbleUp

Simple blog platform built with Node.js, Express and EJS.

## Features
- Create, read, edit and delete blog posts.
- Server-rendered views with EJS ([views/](views/)).
- PostgreSQL storage via `pg` (see [`db`](index.js)).
- Method override to support PATCH/DELETE from forms.

## Quick start

Prerequisites:
- Node.js (v16+)
- PostgreSQL

Install:
```sh
npm install
```

Configure DB:
- Update credentials in [`index.js`](index.js) (client config for PostgreSQL).
- Optionally add an `.env` and ignore it (already in [`.gitignore`](.gitignore)).

Run:
```sh
node index.js
```
App listens on port 3000 by default (see [`app`](index.js)).

## Project structure
- `index.js` — server & routes
- `views/` — EJS templates (home, create, edit, file)
- `public/styles/` — CSS files
- `.gitignore`, `package.json`

## Routes (examples)
- GET / — list blogs
- GET /create — new blog form
- POST /submit — create blog
- GET /blog/:id — view blog
- GET /blog/:id/edit — edit form
- PATCH /blog/:id — update blog
- DELETE /blog/:id — delete blog

## Notes
- Views include header/footer partials: [views/partials/header.ejs](views/partials/header.ejs), [views/partials/footer.ejs](views/partials/footer.ejs).
- Styling: [public/styles/style1.css](public/styles/style1.css), [public/styles/style2.css](public/styles/style2.css), [public/styles/style3.css](public/styles/style3.css).

## License
Unspecified.