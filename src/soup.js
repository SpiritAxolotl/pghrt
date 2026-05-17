import * as BeautifulSoup from "linkedom"; //katie loves soup
import fs from "node:fs";
import path from "node:path";

//for development
if (fs.existsSync("wrangler.jsonc")) {
  const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  if (wrangler.vars) {
    for (const [k, v] of Object.entries(wrangler.vars)) {
      process.env[k] = v;
    }
  }
}

// TO DO
// 1. soup the toc title text to be accurate
// 2. maybe figure out the href title text for external hrefs?
// 3. add alt text to images???
// 4. fix "refer to caption" localization!!!

// MUST ADD FOR NEW LANGS
const lang_flags = {"en": "🇺🇸 English", "de": "🇩🇪 Deutsch", "fr": "🇫🇷 Français"};

//
// begin parsing file
//

// check if a code is used
if (process.argv.length < 2) {
  console.log("MISSING LANGUAGE CODE. Usage: npm run soup -- <language code>");
  process.exit(1);
}

// check if too many codes are used for some reason
//if (process.argv.length < 2) {
//  console.log("TOO MANY LANGUAGE CODES. Usage: npm run soup -- <language code>");
//  process.exit(1);
//}

// build spice cabinet to make soup for each language
// file path relative to main. example: trans/de/spices_de.csv
const language = process.argv[2];
const domain = process.env.DOMAIN;
const spice_name = `spices_${language}.csv`;
const cabinet_file = path.join("trans", language, spice_name);
console.log("Language used: ", language);

// choose html and cover for language
// en carve out for mandatory index.html and no subdomain
let html_loc_name = language + ".html";
let og_url_tag = `https://${language}.${domain}`;
if (language === "en") {
  html_loc_name = "index.html";
  og_url_tag = `https://${domain}`;
}
const html_file = path.join("export", html_loc_name);
const cover_tag = `/img/cover_${language}.png`;

if (!fs.existsSync(html_file)) {
  console.error(html_file, "DOES NOT EXIST. Is your language code wrong or did you not build the HTML?");
  process.exit(1);
}
if (!fs.existsSync(cabinet_file)) {
  console.error(cabinet_file, "DOES NOT EXIST. Is your language code wrong or do you not have your spices?");
  process.exit(1);
}

//
// begin making soup
//

// seasonings for soup. it's a chinese 5 spice blend [read: html loc. also there are five entries in the localization file]
const cabinet = fs.readFileSync(cabinet_file, "utf8").split("\n"); //i know this doesn't cover the literal one edge case that csvs can have but honestly i dont care

// Parse the file into soup
/** just treat this like `document` */
const soup = BeautifulSoup.parseHTML(fs.readFileSync(html_file, "utf8")).document;

//
// rearrange html structure
//

// Create menu button, header, and nest
const header = soup.createElement("div");
header.classList.add("header");

const menu = soup.createElement("button");
menu.id = "menu";
menu.setAttribute("onclick", `document.getElementById('sidebar').classList.toggle('show')`);
menu.textContent = "☰";
header.appendChild(menu);

// Create toggle buttons, header, and nest
const toggles = soup.createElement("div");
toggles.classList.add("togglebuttons");

const theme_toggle = soup.createElement("button");
theme_toggle.id = "theme-toggle";
theme_toggle.textContent = "☀";
toggles.appendChild(theme_toggle);

const font_toggle = soup.createElement("button");
font_toggle.id = "font-toggle";
font_toggle.textContent = "Aa";
toggles.appendChild(font_toggle);

// Extract table of contents navigation
const toc = soup.body.querySelector(`div.ltx_page_main nav`);
// need id to grab to make the menu button work
toc.id = "sidebar";

// correcting a bug in latexml that drops em dash prefixes on toc in html output
for (const line of toc.querySelectorAll(`a[href*="SSx"] > span`)) {
  line.textContent = "—" + line.textContent;
}

// adding a toast
// localization position 0: "Link Copied!"
const toast = soup.createElement("div");
toast.id = "snackbar";
toast.textContent = cabinet[0];

// add return to ref button
// localization position 1: "Return to previous position"
const ref = soup.createElement("div");
ref.id = "return";
ref.title = cabinet[1];

// prepend body with buttons and rearranged table of contents
soup.body.insertAdjacentElement("afterbegin", toc);
soup.body.insertAdjacentElement("afterbegin", header);
soup.body.insertAdjacentElement("afterbegin", toggles);
soup.body.insertAdjacentElement("afterbegin", ref);
soup.body.insertAdjacentElement("afterbegin", toast);

// set the html's lang property to... the language lol (latex defaults it to english)
soup.querySelector(`html`).setAttribute("lang", language);

//
// add html header info
//

// meta: (property, content)
// localization position 2: "A Practical Guide To Feminizing HRT"
// localization position 3: "The futile attempt yadda yadda"
const meta_headers = [
  ["og:title", cabinet[2]],
  ["og:type", "website"],
  ["og:url", og_url_tag],
  ["og:image", cover_tag],
  ["og:description", cabinet[3]],
];

// links: (rel, type, href)
const link_headers = [
  ["icon", "image/png", "/img/favicon.png"],
  ["stylesheet", "text/css", "/pghrtcss.css"]
];

for (const [property, content] of meta_headers) {
  const meta = soup.createElement("meta");
  meta.setAttribute("property", property);
  meta.setAttribute("content", content);
  soup.head.appendChild(meta);
}

for (const [rel, type, href] of link_headers) {
  const link = soup.createElement("link");
  link.rel = rel;
  link.type = type;
  link.href = href;
  soup.head.appendChild(link);
}

// add embed color for sites that embed stuff (discord, telegram, etc)
const meta_theme_color = soup.createElement("meta");
meta_theme_color.setAttribute("name", "theme-color");
meta_theme_color.setAttribute("content", "#FFFFFF");
soup.head.appendChild(meta_theme_color);

const script = soup.createElement("script");
script.type = "text/javascript";
script.src = "/pghrtjs.js";
script.defer = true;
soup.head.appendChild(script);

//
// content manipulation and adjustment
//

// add a selfhosting notice at the top (if selfhosted)
if (process.env.DOMAIN !== "pghrt.diy") {
  const disclaimer = soup.querySelector(".ltx_abstract");
  //will improve this in future
  disclaimer.insertAdjacentHTML("beforebegin", `<div class="ltx_abstract" id="selfhost-notice"> <h6 class="ltx_title ltx_title_abstract">SELFHOSTING NOTICE</h6><p class="ltx_p">This is a selfhosted instance of Katie's pghrt guide (with small QoL changes). The main instance can be found at <a href="https://pghrt.diy/" target="_blank">pghrt.diy</a>, and the repository being used can be found <a href="${process.env.REPOSITORY_LINK}" target="_blank">here</a>.</p><p class="ltx_p">Everything past this notice is written by Katie in her first person perspective. Enjoy reading!</p></div>`);
}

// remove long "title" attribute from the elements that have it
for (const element of soup.querySelectorAll(`[title="In A PRACTICAL GUIDE TO FEMINIZING HRT"]`)) {
  element.removeAttribute("title");
}

// find all the section and question headers then add a click to copy icon
// localization position 4: "Click to copy"
for (const element of soup.querySelectorAll(`h2, h3`)) {
  //find the id of its section
  const hash = element.parentElement.id;
  const new_chain = soup.createElement("a");
  new_chain.classList.add("chain");
  new_chain.href = `#${hash}`;
  new_chain.title = cabinet[4];
  new_chain.setAttribute("onclick", `copyURI(event)`);
  new_chain.textContent = "🔗";
  element.appendChild(new_chain);
}

// changing pdf link
// hosted on github because that keeps the site lighter under cloudflare's 25mb limit
soup.querySelector(`[href="PDF_LINK"]`).href = `https://raw.githubusercontent.com/Juicysteak117/pghrt/refs/heads/main/pdfs/pghrt_${language}.pdf`;

// appending asset links to source of images for the html
// can't get latexml to play nice with graphicspath so this is easier
for (const img of soup.querySelectorAll(`figure > img`)) {
  img.src = path.join("/img", img.src);
}

// hardcoding the other asset links so it plays nice with the subdomain
// (hardcoding was removed, forgot to remove the rest, oops)
//soup.querySelector(`[href="LaTeXML.css"]`).href = "/LaTeXML.css";
//soup.querySelector(`[href="ltx-article.css"]`).href = "/ltx-article.css";

// insert language flag links
const lang_links = Array.from(soup.querySelectorAll("p")).find(p=>p.textContent.includes("LANGUAGE-CODE-DOT-PGHRT-DOT-DIY"));
lang_links.textContent = "";
let first_flag = true;
for (const [lc, flag] of Object.entries(lang_flags)) {
  let url = `https://${lc}.${domain}`;
  if (lc === "en") {
    url = `https://${domain}`;
  }
  const new_flag = soup.createElement("a");
  new_flag.classList.add("ltx_ref", "ltx_href");
  new_flag.href = url;
  //new_flag.title = flag;
  new_flag.textContent = flag;
  if (!first_flag) {
    lang_links.insertAdjacentText("beforeend", ", ");
  }
  first_flag = false;
  lang_links.appendChild(new_flag);
}

// adding an 88x31 button because omg isn't she so cute!???
// what a great suggestion. ty acrylic!!!
// made using: https://hekate2.github.io/buttonmaker/
const cute = soup.createElement("img");
cute.id = "cute";
cute.src = "/img/pghrt_88x31.png";
soup.querySelector(`#Sx1`).insertAdjacentElement("beforebegin", cute);

// replacing \DTMNow with the footer timestamp because there aren't latexml
// bindings for the datetime2 package and i want it to look prettier
// i also remove the double space because it REALLY annoys me. i already sent
// in an issue about it though. eventually i can remove that line lol
// i realize this doesn't localize but truly do i care???? no. come on now.
const dtm = soup.body.querySelector(`span.ltx_ERROR.undefined`);
const timestamp = soup.querySelector(`footer > div`).textContent.match(/Generated\s+on\s+(.+?)\s+by/i)[1];
const time = soup.createElement("time");
time.setAttribute("datetime", (new Date(timestamp)).toISOString());
time.textContent = timestamp;
dtm.parentElement.replaceChild(time, dtm);

const latex_text = soup.querySelector(`footer > div > a`);
const footer_div = latex_text.parentElement;
footer_div.textContent = "";
footer_div.insertAdjacentText("afterbegin", "Generated on ");
footer_div.appendChild(time.cloneNode(true));
footer_div.insertAdjacentText("beforeend", " by ");
footer_div.appendChild(latex_text);

//
// garnish and serve
//

// i'm at soup
console.log("soup made for language: ", language);

// Write the updated soup back out to the file
fs.writeFileSync(html_file, soup.toString());