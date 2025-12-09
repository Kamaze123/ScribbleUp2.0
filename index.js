import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import ejs from "ejs";
import fs from "fs";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.json());
app.set("view engine", "ejs");
app.use("/blog", express.static(path.join(__dirname, "blog")));

app.use(express.static('public'));

app.get("/", (req, res)=>{
    fs.readdir("blog", (err, files)=>{
            if(err){
                return res.render("home", {blogLinks : []});
            }
            else{
                const blogLinks = files.filter(f => f.endsWith(".html"));
                res.render("home", {blogLinks});
            }
    });
});

app.get("/create", (req, res)=>{
    res.render("create");
});                   

app.post("/submit", (req, res)=>{
    const { title, content} = req.body;
    const fileName = title.replace(/ /g, "_").trim() + ".html";

    ejs.renderFile("views/file.ejs", { title, content}, (err, html)=>{
        if(err){
            return res.send("Error generating file");
        } 
        fs.writeFileSync(`blog/${fileName}`, html);
        res.redirect("/");
    });
});

app.listen(port, ()=>{
    console.log(`Listening on port ${3000}`);
});

app.delete("/blog/:title", (req, res)=>{
    const title = req.params.title.trim().replace(/ /g, "_") + ".html";
    const filePath = path.join(__dirname, "blog", title);

    if(!fs.existsSync(filePath)){
        return res.status(404).send("Blog not found");
    }

    fs.unlink(filePath, (err)=>{
        if(err) return res.status(500).send("Error deleting blog");
        res.send("Blog deleted successfully");
    });
});

app.patch("/blog/:title", (req, res)=>{
    const name = req.params.title.trim().replace(/ /g, "_") + ".html";
    const filePath = path.join(__dirname, "blog", name);
   
    if(!fs.existsSync(filePath)){
        return res.status(404).send("Blog not found");
    }

    const newContent = req.body.content;
    const newTitle = req.body.title;
    let updatedHTML;
    
    fs.readFile(filePath, "utf-8", (err, data)=>{
        if(err) return res.status(500).send("Error reading file");

        updatedHTML = data;

        if(newTitle){
            updatedHTML = updatedHTML.replace(
                /<div id = "title">([\s\S]*?)<\/div>/,
                `<div id = "title"><h1>${newTitle}</h1></div>`
            );
        }

        if(newContent){
            updatedHTML = updatedHTML.replace(
                /<div id = "content">([\s\S]*?)<\/div>/,
                `<div id = "content"><p>${newContent}</p></div>`
            );
        }
        
        fs.writeFile(filePath, updatedHTML, (err)=>{
            if(err) return res.status(500).send("Error updating file");
            res.send("Blog updated successfully");
        });
    });
});