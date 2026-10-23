import { execSync } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
//import os from "node:os";
import { parseHTML } from "linkedom";
import { matchesSection, createEmbedPage } from "./worker.js";
const env = JSON.parse(fs.readFileSync("wrangler.jsonc", { encoding: "utf8" })).vars;

const exportDir = "export"; //should not start or end with a slash
//const trash = os.platform() === "win32" ? "NUL" : "/dev/null";

function run(cmd) {
  console.log("Running:", cmd);
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    process.exitCode = 1;
  }
}

function createEmbedPages(langInput="", pageName="") {
  const page = fs.readFileSync(`${exportDir}/${pageName}.html`, { encoding: "utf8" });
  const { document } = parseHTML(page);
  
  const sectionIds = document.querySelectorAll("section[id]")
    .map(s=>s.id)
    .filter(id=>matchesSection(id));
  for (const id of sectionIds) {
    const embedHtml = createEmbedPage(document, id, env);
    if (!fs.existsSync(`${exportDir}/embeds/${langInput}/`)) {
      fs.mkdirSync(`${exportDir}/embeds/${langInput}/`);
    }
    fs.writeFileSync(`${exportDir}/embeds/${langInput}/${id}.html`, embedHtml, { encoding: "utf8" });
  }
}

function buildLanguage(lc="") {
  const langInput = lc.toLowerCase().trim();
  let pageName = langInput === "en" ? "index" : langInput;
  
  const inputPath = `trans/${langInput}/pghrt_${langInput}`;
  
  /*
  if (!fs.existsSync(".venv")) {
    run(`python -m venv .venv`);
    run(`.venv/bin/pip install -r requirements.txt`);
  }
  */
  
  run(`cp -r src/root/* ${exportDir}/`);
  run(`latexmk -pdf -outdir=pdfs -silent ${inputPath}`);
  run(`latexmk -c -outdir=${exportDir} -silent ${inputPath}`);
  run(`latexmlc --destination=${exportDir}/${pageName}.html --log=logs/latexml-${new Date().toISOString().replaceAll(/:-/g, "")}-${langInput}.log ${inputPath}`);
  run(`npm run soup -- ${langInput}`);
  //createEmbedPages(langInput, pageName, process.env);
  //run(`.venv/bin/python src/soup.py ${langInput} ${process.env.DOMAIN}`);
}

async function main() {
  const languages = fs.readdirSync("trans/");
  languages.unshift(languages.splice(languages.indexOf("en"), 1)[0]);
  if (!fs.existsSync("logs")) {
    fs.mkdirSync("logs");
  }
  if (!fs.existsSync(`${exportDir}/embeds/`)) {
    fs.mkdirSync(`${exportDir}/embeds/`, { recursive: true });
  }
  
  let lc = process.argv[2];
  
  if (lc === undefined) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((res) => rl.question(q, res));
    
    console.log(`Currently supported languages: ${languages.join(", ")}`);
    lc = (await ask(`Please input the desired language code, or type "all" to build all\n`)).trim();
    rl.close();
  }
  lc = lc.toLowerCase();
  
  if (languages.includes(lc)) {
    buildLanguage(lc);
  } else if (lc === "" || lc === "all") {
    for (const lang of languages) {
      buildLanguage(lang);
    }
  } else {
    console.log(`"${lc}" is not a language we currently support. Add the required files in trans/${lc} first!`);
    return 1;
  }
  return 0;
}

main();