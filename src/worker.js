import { parseHTML } from "linkedom";
import fs from "node:fs";

const embedFetchingApps = [
  /Discordbot/i,
  /Fluxerbot/i,
  /Bluesky Cardyb/i,
  /TwitterBot/i,
  /TelegramBot/i,
  /WhatsApp/i
];

const sectionRegex = /^S\d+$/i;
const subsectionRegex = /^S\d+\.SS\d+$/i;
const extraSectionRegex = /^Sx\d+$/i;
const extraSubsectionRegex = /^S\d+\.SSx\d+$/i;

export function matchesSection(id="") {
  return [
    sectionRegex,
    subsectionRegex,
    extraSectionRegex,
    extraSubsectionRegex
  ].some(re=>re.test(id));
}

function getSectionNum(id) {
  return id.match(/S(\d+)/i)
}
function getSubsectionNum(id) {
  return 
}
function isExtraSection(id) {
  return [
    extraSectionRegex,
    extraSubsectionRegex
  ].some(re=>re.test(id));
}

/*function markdownify(element=new Element()) {
  let md = "";
  
  for (let i=0; i<element.childNodes.length; i++) {
    const node = element.childNodes[i];
    if (node.nodeType === "ELEMENT_NODE") {
      const el = node.parentElement;
      if (el.classList.contains("ltx_title")) {
        el.querySelector(`a.chain`).remove();
      } else if (el.classList.contains("ltx_tag")) {
        
      }
    } else if (node.nodeType === "TEXT_NODE") {
      
    }
  }
  //const header = element.querySelector(`:scope > .ltx_title`);
  //header.querySelector(`a.chain`).remove();
  //const section = header.querySelector(`:scope > .ltx_tag`);
  //let sectionText = section ? section.textContent.trim() : "";
  //if (section) section.remove();
  //md += `# [${sectionText !== "" ? sectionText + " - " : ""}${header.textContent.trim()}](#${element.id})`;
  
  
  
  return md;
}*/

function createOpengraphHtml(title="", description="", color="", images=[], id) {
  const { document } = parseHTML(`<!DOCTYPE HTML><html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"><style>:root{color-scheme: light dark;}</style></head><body></body></html>`);
  function createMetaTag(attributes) {
    const meta = document.createElement("meta");
    for (const [attribute, value] of Object.entries(attributes).reverse()) { //reversed cuz it inserts at the front
      meta.setAttribute(attribute, value);
    }
    document.head.appendChild(meta);
  }
  if (title) {
    /*const ogTitleElement = document.head.querySelector(`meta[property="og:title"]`);
    if (ogTitleElement) {
      ogTitleElement.setAttribute("content", title);
    } else {*/
    const titleElement = document.createElement("title");
    titleElement.textContent = title;
    document.head.appendChild(titleElement);
    createMetaTag({ property: "og:title", content: title });
    //}
  }
  if (description) {
    /*const ogDescriptionElement = document.head.querySelector(`meta[property="og:description"]`);
    if (ogDescriptionElement) {
      ogDescriptionElement.setAttribute("content", description);
    } else {*/
    createMetaTag({ name: "description", content: description });
    createMetaTag({ property: "og:description", content: description });
    //}
  }
  if (color) {
    /*const themeColorElement = document.head.querySelector(`meta[name="theme-color"]`);
    if (colorElement) {
      themeColorElement.setAttribute("content", color);
    } else {*/
    createMetaTag({ name: "theme-color", content: color });
    //}
  }
  if (images) {
    for (const meta of document.querySelectorAll(`head > meta[property="og:image"]`)) {
      document.head.removeChild(meta);
    }
    createMetaTag({ name: "twitter:card", content: "summary_large_image" });
    //will max out at 4 embed images
    const maxImages = 4;
    for (let i=0; i<images.length && i<maxImages; i++) {
      const image = images[i].url;
      createMetaTag({ property: "og:image", content: image });
    }
  }
  document.body.innerHTML = `Here by accident? <a href="/#${id}">This is the page you're probably looking for.</a>`;
  return document;
}

async function fetchLang(env, request) {
  const url = new URL(request.url);
  const path = url.pathname.match(/^\/(.*)\/?$/)[1];
  const domain = env.DOMAIN === url.host.split(".").slice(1).join(".") ? env.DOMAIN : url.host;
  const dev = /^localhost:\d+$/.test(domain);
  const subdomain = !dev && domain !== url.host ? url.hostname.slice(0, url.hostname.lastIndexOf(env.DOMAIN) - 1) : "";
  
  if (isExtraSection(path)) {
    return await env.ASSETS.fetch(`${url.protocol}//${domain}/${subdomain}`);
  }
  
  if (path === "en" || subdomain === "en") {
    return new Response(null, {
      "status": 301,
      "headers": {
        "Location": `${url.protocol}//${domain}/`
      }
    });
  }
  
  if (subdomain && path === subdomain) {
    return new Response(null, {
      "status": 301,
      "headers": {
        "Location": `${url.protocol}//${subdomain}.${domain}/`
      }
    });
  }
  
  if (/[a-z]{2}/i.test(path) && path !== subdomain) {
    return new Response(null, {
      "status": 301,
      "headers": {
        "Location": `${url.protocol}//${path ? path + "." : ""}${domain}/`
      }
    });
  }
  
  return await env.ASSETS.fetch(`${url.protocol}//${domain}/${subdomain}`);
}

export function createEmbedPage(document=new Document(), id="", env={}, isItDiscord=false) {
  const linkedElement = document.getElementById(id);
  if (linkedElement) {
    let title = "";
    let description = "";
    const Colors = {
      BLUE: "#6DCFFA",
      PINK: "#F0AAB9",
      WHITE: isItDiscord ? "#FEFEFE" : "#FFFFFF", //DISCORD DOESN'T PREVIEW PURE WHITE ANYMORE RAHHHHHHHH
    };
    Object.freeze(Colors); //unnecessary but whatever it's fun
    
    let color = Colors.PINK; //old: Colors.WHITE;
    if (sectionRegex.test(id)) {
      color = Colors.BLUE;
    } else {
      const index = Array.from(linkedElement.parentElement.querySelectorAll(`:scope > section`)).indexOf(linkedElement);
      color = Object.values(Colors)[(index+1) % 3];
    }
    const images = [];
    
    //this doesn't support nested ones but it's fineeee
    for (const li of linkedElement.querySelectorAll("li:has(p)")) {
      const p = li.querySelector("p");
      //p.textContent = li.querySelector("span.ltx_tag").textContent + " " + p.textContent;
      p.textContent = "- " + p.textContent;
    }
    
    if (sectionRegex.test(id)) {
      title = linkedElement.querySelector("h2").textContent;
      if (linkedElement.querySelector("h2 + div")) {
        description = Array.from(linkedElement.querySelectorAll("p")).map(p=>p.textContent).join("\n");
      }
      //color = Colors.BLUE;
    } else {
      title = linkedElement.querySelector("h3").textContent;
      description = Array.from(linkedElement.querySelectorAll("p")).map(p=>p.textContent).join("\n");
      //color = Colors.PINK;
    }
    //description.replaceAll(/^(?<=^- .+\n)(.+)$/gm, "\n$1");
    for (const image of linkedElement.querySelectorAll(":scope > figure > img")) {
      const figcaption = image.parentElement.querySelector("figcaption");
      let alt = figcaption.textContent;
      alt = alt.substring(alt.length - alt.indexOf(figcaption.querySelector("span").textContent));
      images.push({
        url: `https://${env.DOMAIN}${image.src}`,
        alt
      });
    }
    title = title.replace("🔗", "");
    title = title.replace(/^\s*\d+(\.\d+)?\s*/, "");
    title = title.trim();
    
    title += ` | ${env.DOMAIN}`;
    
    const page = createOpengraphHtml(title, description, color, images, id);
    
    //discord's components v2 embed info documented at https://docs.discord.com/developers/link-previews/component-embeds
    /*const script = document.createElement("script");
    script.id = "discord:component-embed";
    script.type = "application/vnd.discord.component-embed+json";
    const components = JSON.parse(fs.readFileSync("src/discord-components-template.json", { encoding: "utf8" }));
    components.component.accent_color = parseInt(color.slice(1), 16);
    components.component.components[0].content = markdownify(linkedElement.cloneNode(true));
    script.innerHTML = JSON.stringify(components);
    page.head.appendChild(script);*/
    return page.toString();
  } else {
    console.log("id:", id);
    //console.log("document:", document);
    console.log("document.toString():", document.toString());
    console.log("linkedElement:", linkedElement);
    throw new Error("why is there no linked element??");
  }
}

export default {
  async fetch(request, env, ctx) {
    const ua = request.headers.get("User-Agent");
    const url = new URL(request.url);
    const path = url.pathname.slice(1);
    if (matchesSection(path)) {
      //if (embedFetchingApps.some(app=>app.test(ua))) {
        const { document } = parseHTML(await env.ASSETS.fetch(url.origin).then(response=>response.text()));
        const page = createEmbedPage(document, path, env, /Discordbot/i.test(ua));
        return new Response(page.toString(), {
          "status": 200,
          "statusText": "OK",
          "headers": { "Content-Type": "text/html" }
        });
      //}
      url.hash = path;
      url.pathname = "/";
      return new Response(null, {
        "status": 301,
        "headers": { "Location": url.toString() }
      });
    }
    if (url.pathname.split(".").length === 1) {
      const resp = await fetchLang(env, request);
      if (resp.status === 404) {
        let origin = `https://${url.host.split(".").slice(1).join(".")}`;
        if (url.host.split(".").length === 1) {
          origin = "http://" + url.hostname;
        }
        const page404 = await env.ASSETS.fetch(new Request(`${origin}/404.html`));
        return new Response(page404.body, {
          "status": 404,
          "statusText": "Not Found",
          "headers": { "Content-Type": "text/plain" }
        });
      }
      return resp;
    }
    
    return await env.ASSETS.fetch(request);
  }
}