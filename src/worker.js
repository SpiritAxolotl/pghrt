import { parseHTML } from "linkedom";

const embedFetchingApps = [
  "+https://discordapp.com",
  "+https://fluxer.app",
  "support@bsky.app",
  "twitterbot",
  "telegrambot",
  "whatsapp"
];

function createOpengraphHtml(head, title, description, color) {
  const { document } = parseHTML(`<!DOCTYPE HTML><html><head>${head.innerHTML}</head><body></body></html>`);
  function createMetaTag(attributes) {
    const meta = document.createElement("meta");
    for (const [attribute, value] of Object.entries(attributes)) {
      meta.setAttribute(attribute, value);
    }
    document.head.appendChild(meta);
  }
  const titleElement = document.head.querySelector(`meta[property="og:title"]`);
  if (titleElement) {
    titleElement.setAttribute("content", title);
  } else {
    createMetaTag({ property: "og:title", content: title });
  }
  if (description) {
    const descriptionElement = document.head.querySelector(`meta[property="og:description"]`);
    if (descriptionElement) {
      descriptionElement.setAttribute("content", description);
    } else {
      createMetaTag({ property: "og:description", content: description });
    }
  }
  if (color) {
    const colorElement = document.head.querySelector(`meta[name="theme-color"]`);
    if (colorElement) {
      colorElement.setAttribute("content", color);
    } else {
      createMetaTag({ name: "theme-color", content: color });
    }
  }
  return document.toString();
}

async function fetchLang(env, request) {
  const url = new URL(request.url);
  const path = url.pathname.match(/^\/(.*)\/?$/)[1];
  const domain = env.DOMAIN === url.host.split(".").slice(1).join(".") ? env.DOMAIN : url.host;
  const dev = /^localhost:\d+$/.test(domain);
  const subdomain = !dev && domain !== url.host ? url.hostname.slice(0, url.hostname.lastIndexOf(env.DOMAIN) - 1) : "";
  
  if (/^\/S(\d+(\.SSx?\d+)?|x\d+)$/i.test(url.pathname)) {
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
  
  const resp = await env.ASSETS.fetch(`${url.protocol}//${domain}/${subdomain}`);
  return new Response(resp.body, {
    "headers": { "Content-Type": "text/html" }
  });
}

export default {
  async fetch(request, env, ctx) {
    const ua = request.headers.get("User-Agent");
    const url = new URL(request.url);
    if (/^\/S(\d+(\.SSx?\d+)?|x\d+)$/i.test(url.pathname)) {
      if (embedFetchingApps.some(app=>ua.includes(app))) {
        const doc = await fetchLang(env, request).then(response => response.text());
        const { document } = parseHTML(doc);
        const linkedElement = document.getElementById(url.pathname.slice(1));
        if (linkedElement) {
          let title;
          let description;
          let color = "#FFFFFF";
          if (/^\/S((\d*\.SS)?x)?\d+$/i.test(url.pathname)) {
            title = linkedElement.querySelector("h2, h3").textContent;
            if (linkedElement.querySelector("h2 + div")) {
              description = Array.from(linkedElement.querySelectorAll("p")).map(e=>e.textContent).join("\n");
            }
            color = "#6DCFFA";
          } else {
            title = linkedElement.querySelector("h3").textContent;
            description = Array.from(linkedElement.querySelectorAll("p")).map(e=>e.textContent).join("\n");
            color = "#F0AAB9";
          }
          title = title.replace("🔗", "")
          title = title.replace(/^\s*\d+(\.\d+)?\s*/, "");
          title = title.trim();
          
          title += " | pghrt.diy";
          
          return new Response(createOpengraphHtml(document.head, title, description, color), {
            "status": 200,
            "statusText": "OK",
            "headers": { "Content-Type": "text/html" }
          });
        }
        
        return new Response(null, {
          "status": 301,
          "headers": { "Location": "/" }
        });
      }
      url.hash = url.pathname.slice(1);
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