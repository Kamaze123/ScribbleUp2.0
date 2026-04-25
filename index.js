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

dotenv.config();

const app = express();

const PgSession = connectPgSimple(session);

const { Pool } = pg;

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    max : 20,
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
        const result = await pool.query('SELECT id, title, content, created_at, user_id, created_by FROM blog ORDER BY created_at DESC');
        const blogs = result.rows;
        res.render("home", { blogLinks: blogs });
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

app.patch("/blog/:id", async (req, res)=>{
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