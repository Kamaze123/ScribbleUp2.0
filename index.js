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

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3000;

app.use(methodOverride('_method'));

console.log("process.env.PG_PASSWORD):", process.env.PG_PASSWORD);

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD
});

db.connect((err)=>{
    if(err){
        console.error("Error connecting to database", err);}
    else{
        console.log("Connected to database successfully");
    }
});

app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.json());
app.set("view engine", "ejs");
app.use("/blog", express.static(path.join(__dirname, "blog")));
app.use(express.static('public'));


app.get("/", async (req, res)=>{
    
    try{
        const result = await db.query('SELECT id, title, content, created_at FROM blog ORDER BY created_at DESC');
        const blogs = result.rows;
        res.render("home", { blogLinks: blogs });
    }catch(err){
        console.error("Error fetching blogs from database", err);
        res.render("home", { blogLinks: [] });
    }
});

app.get("/create", (req, res)=>{
    res.render("create");
});                   

app.post("/submit", async (req, res)=>{
    const { title, content} = req.body;

    try{
        await db.query('INSERT INTO blog (title, content) VALUES ($1, $2)', [title, content]);
        console.log('Blog saved successfully to database');
        res.redirect("/");
    }catch(err){
        console.error('Error saving blog:', err);
        res.send("Error saving blog");
    }
});

app.listen(port, ()=>{
    console.log(`Listening on port ${3000}`);
});

app.get("/blog/:id", async (req, res)=>{
    const blogId = req.params.id;
    
    try{
        const result = await db.query('SELECT * FROM blog WHERE id = $1', [blogId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Blog not found");
        }
        const blog = result.rows[0];
        console.log(blog);
        res.render("file", { title: blog.title, content: blog.content, created : blog.created_at, blogId : blog.id});
    }catch(err){
        console.error("Error fetching blog from database", err);
        res.status(500).send("Error fetching blog");
    }
});

app.get("/blog/:id/edit", async (req, res)=>{
    const id = req.params.id;
    try{
        const result = await db.query(
            "SELECT id, title, content FROM blog WHERE id = $1",[id]
        );

        if (result.rowCount === 0) {
            return res.status(404).send("Blog not found");
        }

        res.render("edit", { blog: result.rows[0] });
    }catch(err){
        console.error("Error fetching blog for edit:", err);
        res.status(500).send("Error fetching blog for edit");
    }
});

app.delete("/blog/:id", async (req, res)=>{
    const blogId = req.params.id;

    try{
        const result = await db.query('DELETE FROM blog WHERE id = $1', [blogId]);
        if (result.rowCount === 0) {
            return res.status(404).send("Blog not found");
        }
        res.redirect("/");
    }catch(err){
        console.error("Error deleting blog from database", err);
        res.status(500).send("Error deleting blog");
    }
});

app.patch("/blog/:id", async (req, res)=>{
    const { id } = req.params;
    const { title, content } = req.body;

    try{
        const result = await db.query(
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