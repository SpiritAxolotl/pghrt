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

function isExtraSection(id) {
  return [
    extraSectionRegex,
    extraSubsectionRegex
  ].some(re=>re.test(id));
}

const NODE_TYPES = {
  "1":  "ELEMENT_NODE",
  "2":  "ATTRIBUTE_NODE",
  "3":  "TEXT_NODE",
  "4":  "CDATA_SECTION_NODE",
  "7":  "PROCESSING_INSTRUCTION_NODE",
  "8":  "COMMENT_NODE",
  "9":  "DOCUMENT_NODE",
  "10": "DOCUMENT_TYPE_NODE",
  "11": "DOCUMENT_FRAGMENT_NODE"
};
Object.freeze(NODE_TYPES);

function markdownifyElement(element=new Element(), env) {
  let md = "";
  
  function escapeText(text="") {
    return text.replaceAll(/[\*_\|\-]/g, "\\$1").trim();
  }
  
  let section = false;
  if (sectionRegex.test(element.id)) {
    section = true;
  }
  for (let i=0; i<element.childNodes.length; i++) {
    const node = element.childNodes[i];
    const parent = node.parentElement;
    
    if (NODE_TYPES[node.nodeType] === "ELEMENT_NODE") {
      const classes = node.classList;
      if (classes.contains("ltx_title")) {
        //parent.querySelector(`a.chain`).remove();
        const ltxTag = node.querySelector(".ltx_tag");
        if (ltxTag) {
          md += `# [${escapeText(ltxTag.textContent)} – ${escapeText(ltxTag.nextSibling.textContent)}](<https://${env.DOMAIN}/${escapeText(node.querySelector("a").href)}>)\n`;
        } else {
          md += `# [${escapeText(node.firstChild.textContent)}](<${escapeText(node.querySelector("a").href)}>)\n`;
        }
        if (section) {
          break;
        }
        continue;
      }
      if (classes.contains("ltx_itemize")) {
        for (const item of node.querySelectorAll("li > .ltx_para")) {
          md += /*"- " +*/ markdownifyElement(item, env).replace(/\n{2,}$/, "\n");
        }
        continue;
      }
      if (classes.contains("ltx_figure") || classes.contains("ltx_table")) {
        continue;
      }
      let text = markdownifyElement(node, env);
      if (classes.contains("ltx_font_italic")) {
        text = `_${text}_`;
      }
      if (classes.contains("ltx_font_bold")) {
        text = `**${text}**`;
      }
      if (classes.contains("ltx_ref")) {
        if (!node.href.startsWith("http")) {
          text = `[${text}](<https://${env.DOMAIN}/${node.href}>)`;
        } else {
          text = `[${text}](<${node.href}>)`;
        }
      }
      if (classes.contains("ltx_framed_underline")) {
        text = `__${text}__`;
      }
      md += text;
    } else if (NODE_TYPES[node.nodeType] === "TEXT_NODE") {
      if (parent.classList.contains("ltx_para") && node.nextSibling === null) {
        md += node.textContent + "\n\n";
      } else {
        if (node.textContent !== "\n") {
          md += node.textContent.replace(/\n{2,}$/, "\n");
        }
      }
    }
  }
  
  return md;
}

export function markdownify(element=new Element(), env) {
  let md = markdownifyElement(element, env);
  return md.replaceAll(/\n{3,}/g, "\n\n").trim();
}

function createOpengraphHtml(title="", description="", color="", images=[], id) {
  const { document } = parseHTML(
    `<!DOCTYPE HTML><html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"><style>:root{color-scheme: light dark;}</style></head><body></body></html>`
  );
  function createMetaTag(attributes) {
    const meta = document.createElement("meta");
    for (const [attribute, value] of Object.entries(attributes).reverse()) { //reversed cuz it inserts at the front
      meta.setAttribute(attribute, value);
    }
    document.head.appendChild(meta);
  }
  createMetaTag({ name: "robots", content: "noindex" });
  if (title) {
    const titleElement = document.createElement("title");
    titleElement.textContent = title;
    document.head.appendChild(titleElement);
    createMetaTag({ property: "og:title", content: title });
  }
  if (description) {
    createMetaTag({ name: "description", content: description });
    createMetaTag({ property: "og:description", content: description });
  }
  if (color) {
    createMetaTag({ name: "theme-color", content: color });
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

function getLangInfo(env, url) {
  const domain = env.DOMAIN === url.host.split(".").slice(1).join(".") ? env.DOMAIN : url.host;
  const dev = /^localhost:\d+$/.test(domain);
  const subdomain = !dev && domain !== url.host ? url.hostname.slice(0, url.hostname.lastIndexOf(env.DOMAIN) - 1) : "";
  const lang = subdomain ? subdomain : "en";
  return {domain, subdomain, lang};
}

async function fetchLang(env, request) {
  const url = new URL(request.url);
  const path = url.pathname.match(/^\/(.*)\/?$/)[1];
  const {domain, subdomain} = getLangInfo(env, url);
  
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
    
    let color = Colors.BLUE;
    if (!sectionRegex.test(id)) {
      const index = Array.from(linkedElement.parentElement.querySelectorAll(`:scope > section`)).indexOf(linkedElement);
      color = Object.values(Colors)[(index+1) % 3];
    }
    const images = [];
    
    //this doesn't support nested ones but it's fineeee
    for (const li of linkedElement.querySelectorAll(":scope > div > ul > li:has(> div > p)")) {
      li.querySelector(`:scope > span`).remove();
      const p = li.querySelector("p");
      //p.textContent = li.querySelector("span.ltx_tag").textContent + " " + p.textContent;
      p.textContent = "- " + p.textContent;
    }
    
    if (sectionRegex.test(id)) {
      title = linkedElement.querySelector("h2").textContent;
      if (linkedElement.querySelector("h2 + div")) {
        description = Array.from(linkedElement.querySelectorAll("p")).map(p=>p.textContent).join("\n");
      }
    } else {
      title = linkedElement.querySelector("h2, h3").textContent;
      description = Array.from(linkedElement.querySelectorAll("p")).map(p=>p.textContent).join("\n");
    }
    //description.replaceAll(/^(?<=^- .+\n)(.+)$/gm, "\n$1");
    for (const image of linkedElement.querySelectorAll(":scope > figure > img")) {
      const figcaption = image.parentElement.querySelector(":scope > figcaption > span").nextSibling;
      let alt = figcaption.textContent;
      //alt = alt.substring(alt.length - alt.indexOf(figcaption.querySelector("span").textContent));
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
    const script = document.createElement("script");
    script.id = "discord:component-embed";
    script.type = "application/vnd.discord.component-embed+json";
    const components = JSON.parse(fs.readFileSync("src/discord-components-template.json", { encoding: "utf8" }));
    components.component.accent_color = parseInt(color.slice(1), 16);
    components.component.components[0].content = markdownify(linkedElement, env); /*.cloneNode(true)*/
    if (images.length === 0) {
      components.component.components.splice(1, 1);
    } else {
      const imgs = [];
      for (const image of images) {
        const imgformat = {...components.component.components[1].items[0]};
        imgformat.media.url = image.url;
        imgformat.description = image.alt;
        imgs.push(imgformat);
      }
      components.component.components[1].items = imgs;
    }
    script.innerHTML = JSON.stringify(components);
    page.head.appendChild(script);
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
    if (request.method !== "GET") {
      return new Response(null, {
        "status": 405,
        "allow": "GET"
      });
    }
    if (matchesSection(path)) {
      if (embedFetchingApps.some(app=>app.test(ua))) {
        const { lang } = getLangInfo(env, url);
        return env.ASSETS.fetch(`${url.protocol}//${url.host}/embeds/${lang}/${path}.html`);
      }
      url.hash = path;
      url.pathname = "/";
      return new Response(null, {
        "status": 302,
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