import { parseHTML } from "linkedom";

const embedFetchingApps = [
  "+https://discordapp.com",
  "+https://fluxer.app",
  "support@bsky.app",
  "twitterbot",
  "telegrambot",
  "whatsapp"
];

function createOpengraphHtml(head, title, description) {
  const { document } = parseHTML(`<!DOCTYPE HTML><html><head>${head.innerHTML}</head><body</body></html>`);
  function createMetaTag(property, content) {
    const meta = document.createElement("meta");
    meta.setAttribute("property", property);
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }
  const titleElement = document.head.querySelector(`meta[property="og:title"]`);
  if (titleElement !== null) {
    titleElement.setAttribute("content", title);
  } else {
    createMetaTag("og:title", title);
  }
  if (description) {
    const descriptionElement = document.head.querySelector(`meta[property="og:description"]`);
    if (descriptionElement !== null) {
      descriptionElement.setAttribute("content", description);
    } else {
      createMetaTag("og:description", description);
    }
  }
  console.log(document.toString());
  return document.toString();
}

export default {
  async fetch(request, env, ctx) {
    const ua = request.headers.get("User-Agent");
    const url = new URL(request.url);
    if (/^\/S(\d+(\.SSx?\d+)?|x\d+)$/i.test(url.pathname)) {
      if (embedFetchingApps.some(app=>ua.includes(app))) {
        const doc = await env.ASSETS.fetch(new Request(url.origin + "/")).then(response => response.text());
        const { document } = parseHTML(doc);
        const linkedElement = document.getElementById(url.pathname.slice(1));
        let title;
        let description;
        if (/^\/S\d+$/i.test(url.pathname)) {
          title = linkedElement.querySelector("h2").textContent;
        } else {
          title = linkedElement.querySelector("h3").textContent;
          description = Array.from(linkedElement.querySelectorAll("p")).map(e=>e.textContent).join("\n");
        }
        
        title = title.replace("🔗", "").trim();
        
        return new Response(createOpengraphHtml(document.head, title, description), {
          status: 202,
          statusText: "OK",
          headers: { "Content-Type": "text/html" }
        });
      }
      url.hash = url.pathname.slice(1);
      url.pathname = "/";
      return new Response(null, {
        status: 301,
        statusText: "Moved Permanently",
        headers: { "Location": url.toString() }
      });
    }
    return await env.ASSETS.fetch(request);
  }
}