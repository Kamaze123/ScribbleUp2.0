import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import pg from "pg";
import methodOverride from "method-override";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
const PgSession = connectPgSimple(session);
const { Pool } = pg;
const cache = new NodeCache({stdTTL:60});

console.log(process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});


pool.connect((err)=>{
    if(err){
        console.error("Error connecting to database", err);}
    else{
        console.log("Connected to database successfully");
    }
});

app.use(session({
  store: new PgSession({
    pool,                       
    tableName: "session",        
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "changeme",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, //7days login session
}));

app.use(passport.initialize());
app.use(passport.session());


passport.use(new LocalStrategy(
  { usernameField: "email" },
  async (email, password, done) => {
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];
      if (!user) return done(null, false, { message: "No user found" });
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return done(null, false, { message: "Wrong password" });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  "/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email    = profile.emails[0].value;
      const googleId = profile.id;

      // 1. Already linked? Just log in
      const linked = await pool.query(
        "SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_id = $1",
        [googleId]
      );
      if (linked.rows.length > 0) {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [linked.rows[0].user_id]);
        return done(null, user.rows[0]);
      }

      // 2. Email matches an existing user? Link and log in
      let user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

      // 3. No user at all? Create one (no password needed)
      if (user.rows.length === 0) {
        const username = profile.displayName.replace(/\s+/g, "_").toLowerCase() + "_" + profile.id.slice(0, 5);
        user = await pool.query(
          "INSERT INTO users (username, email, role) VALUES ($1, $2, 'author') RETURNING *",
          [username, email]
        );
      }

      // 4. Link the OAuth account
      await pool.query(
        "INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, 'google', $2) ON CONFLICT DO NOTHING",
        [user.rows[0].id, googleId]
      );

      return done(null, user.rows[0]);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (req.isAuthenticated() && roles.includes(req.user.role)) return next();
    res.status(403).render("error", { message: "Access denied" });
  };
}



const __dirname = dirname(fileURLToPath(import.meta.url));

const port = process.env.PORT || 3000;

app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.json());
app.set("view engine", "ejs");
app.use("/blog", express.static(path.join(__dirname, "blog")));
app.use(express.static('public'));



app.get("/", async (req, res)=>{
    
    try{
      const cached = cache.get("blogs");

      if (cached) return res.render("home", { blogLinks: cached });

      const result = await pool.query("SELECT ...");
      cache.set("blogs", result.rows);
      res.render("home", { blogLinks: result.rows });
      
    }catch(err){
        console.error("Error fetching blogs from database", err); 
        res.render("home", { blogLinks: [] });
    }
});

app.get("/register", (req, res) => res.render("register", { error: null }));

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'author')",
      [username, email, hash]
    );
    res.redirect("/login");
  } catch (err) {
    const message = err.code === "23505" ? "Email or username already exists" : "Error registering";
    res.render("register", { error: message });
  }
});

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.render("login", { error: info.message });
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  })(req, res, next);
});

app.post("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));  //logs out the user and redirects to home page
});

app.get("/create", requireAuth, requireRole("author", "editor", "admin"), (req, res)=>{
    res.render("create");
});                   

app.post("/submit", requireAuth, requireRole("author", "editor", "admin"), async (req, res)=>{
    const { title, content} = req.body;

    await pool.query(
    "INSERT INTO blog (title, content, user_id, created_by) VALUES ($1, $2, $3, $4)", [title, content, req.user.id, req.user.username]
    );
    res.redirect("/");
});

app.listen(port, ()=>{
    console.log(`Listening on port ${3000}`);
});

app.get("/blog/:id", async (req, res)=>{
    const blogId = req.params.id;
    
    try{
        const result = await pool.query('SELECT * FROM blog WHERE id = $1', [blogId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Blog not found");
        }
        const blog = result.rows[0];
        console.log(blog);
        res.render("file", { title: blog.title, content: blog.content, created : blog.created_at, blogId : blog.id, blogUserId: blog.user_id});
    }catch(err){
        console.error("Error fetching blog from database", err);
        res.status(500).send("Error fetching blog");
    }
});

app.get("/blog/:id/edit", requireAuth, async (req, res)=>{
  
  const result = await pool.query("SELECT * FROM blog WHERE id = $1", [req.params.id]);
  const blog = result.rows[0];
  if (!blog) return res.status(404).send("Not found");

  const canEdit = req.user.role === "admin" || req.user.role === "editor"
                  || blog.user_id === req.user.id;
  if (!canEdit) return res.status(403).send("Access denied");

  res.render("edit", { blog });
});

app.delete("/blog/:id", requireAuth, async (req, res)=>{
    const result = await pool.query("SELECT user_id FROM blog WHERE id = $1", [req.params.id]);
    const blog = result.rows[0];
      if (!blog) return res.status(404).send("Not found");

      const canDelete = req.user.role === "admin" || req.user.role === "editor"
                    || blog.user_id === req.user.id;
  if (!canDelete) return res.status(403).send("Access denied");

  await pool.query("DELETE FROM blog WHERE id = $1", [req.params.id]);
  res.redirect("/");
});

app.patch("/blog/:id", requireAuth, async (req, res)=>{
    const { id } = req.params;
    const { title, content } = req.body;

    try{
        const result = await pool.query(
        `UPDATE blog
        SET title = COALESCE($1, title),
           content = COALESCE($2, content)
       WHERE id = $3`,
      [title, content, id]
    );

        if (result.rowCount === 0) {
            return res.status(404).send("Blog not found");
        }

        res.redirect("/");
    }catch(err){
        console.error("Error updating blog:", err);
        res.status(500).send("Error updating blog");
    }

});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => res.redirect("/")
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { message: "Something went wrong" });
});