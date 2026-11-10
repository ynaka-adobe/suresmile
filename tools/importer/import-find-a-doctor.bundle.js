/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-find-a-doctor.js
  var import_find_a_doctor_exports = {};
  __export(import_find_a_doctor_exports, {
    default: () => import_find_a_doctor_default
  });

  // tools/importer/parsers/hero-split.js
  function parse(element, { document }) {
    const img = element.querySelector(":scope > img, :scope > picture") || element.querySelector("img");
    const textSection = element.querySelector(".text-section") || element;
    const content = [];
    const heading = textSection.querySelector("h1, h2");
    const headingIsChild = heading && heading.parentElement === textSection;
    if (heading && !headingIsChild) content.push(heading);
    [...textSection.children].forEach((child) => {
      if (child === heading) {
        content.push(heading);
        return;
      }
      if (child.contains(heading)) return;
      if (child.querySelector("a") || child.tagName === "A") return;
      const text = child.textContent.trim();
      if (!text) return;
      const p = document.createElement("p");
      p.innerHTML = child.innerHTML;
      content.push(p);
    });
    textSection.querySelectorAll("a[href]").forEach((a) => {
      if (!a.textContent.trim()) return;
      const p = document.createElement("p");
      const link = document.createElement("a");
      link.href = a.getAttribute("href");
      link.textContent = a.textContent.trim();
      p.append(link);
      content.push(p);
    });
    const cells = [];
    cells.push([img || ""]);
    cells.push([content]);
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-split", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/search-locator.js
  var FIND_A_DOCTOR = "/en-us/find-a-doctor";
  function textRow(document, text) {
    const p = document.createElement("p");
    p.textContent = text;
    return [p];
  }
  function parse2(element, { document }) {
    var _a, _b;
    const form = element.querySelector("form") || element;
    const cells = [];
    const label = form.querySelector("label");
    cells.push(textRow(document, label ? label.textContent.trim() : "Search by address or postal code"));
    const input = form.querySelector('input:not([type="hidden"])');
    const placeholder = input && (input.getAttribute("placeholder") || input.getAttribute("aria-label")) || "Your location";
    cells.push(textRow(document, placeholder));
    const options = [...form.querySelectorAll("select option")];
    const nums = options.map((o) => (o.textContent.match(/\d+/) || [])[0]).filter(Boolean);
    const radii = nums.length ? nums : ["5", "10", "25", "50"];
    const explicitOpt = options.find((o) => o.hasAttribute("selected"));
    const shown = (_b = (_a = form.querySelector("select")) == null ? void 0 : _a.previousElementSibling) == null ? void 0 : _b.querySelector("span");
    const fallbackOpt = options.find((o) => o.selected);
    const defaultText = explicitOpt && explicitOpt.textContent || shown && shown.textContent || fallbackOpt && fallbackOpt.textContent || "";
    const def = (defaultText.match(/\d+/) || [])[0] || "10";
    const radiusP = document.createElement("p");
    radii.forEach((n, i) => {
      if (i) radiusP.append(document.createTextNode(", "));
      if (n === def) {
        const strong = document.createElement("strong");
        strong.textContent = n;
        radiusP.append(strong);
      } else {
        radiusP.append(document.createTextNode(n));
      }
    });
    cells.push([radiusP]);
    const buttons = [...form.querySelectorAll("button")];
    const submit = buttons.find((b) => /find a doctor/i.test(b.textContent)) || buttons.find((b) => b.type === "submit");
    const actionP = document.createElement("p");
    const link = document.createElement("a");
    link.href = FIND_A_DOCTOR;
    link.textContent = submit ? submit.textContent.trim() : "Find a doctor";
    actionP.append(link);
    cells.push([actionP]);
    const geo = buttons.find((b) => /location/i.test(b.textContent));
    if (geo) cells.push(textRow(document, geo.textContent.trim()));
    const block = WebImporter.Blocks.createBlock(document, { name: "search-locator", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/search-results-map.js
  var SOURCE_URL = "https://www.suresmile.com/api/location/doctors";
  function keyRow(document, key, value) {
    const k = document.createElement("p");
    k.textContent = key;
    return [k, value];
  }
  function textP(document, text) {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }
  function parse3(element, { document }) {
    const cells = [];
    const link = document.createElement("a");
    link.href = SOURCE_URL;
    link.textContent = SOURCE_URL;
    const sourceP = document.createElement("p");
    sourceP.append(link);
    cells.push(keyRow(document, "source", sourceP));
    const notFound = element.querySelector("section.not-found");
    const nfParas = notFound ? [...notFound.querySelectorAll(":scope > p")] : [];
    const nfHeading = nfParas[0] && nfParas[0].textContent.trim() || "We\u2019re sorry";
    const nfMessage = nfParas[1] && nfParas[1].textContent.trim() || "We couldn\u2019t find any SureSmile doctors in this area. Try expanding your search.";
    const headP = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = nfHeading;
    headP.append(strong);
    cells.push(keyRow(document, "no-results", [headP, textP(document, nfMessage)]));
    cells.push(keyRow(document, "results-label", textP(document, "{count} results for")));
    cells.push(keyRow(document, "per-page", textP(document, "20")));
    const pagination = element.querySelector("nav.pagination");
    if (pagination) {
      const label = pagination.getAttribute("aria-label");
      if (label && label.trim()) cells.push(keyRow(document, "pagination-label", textP(document, label.trim())));
      [["prev", "previous-label"], ["next", "next-label"]].forEach(([cls, key]) => {
        const btn = pagination.querySelector(`button.${cls}`);
        if (!btn) return;
        const text = (btn.getAttribute("aria-label") || btn.textContent || "").trim();
        if (text) cells.push(keyRow(document, key, textP(document, text)));
      });
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "search-results-map", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-promo.js
  function parse4(element, { document }) {
    const cells = [];
    element.querySelectorAll("article").forEach((article) => {
      const img = article.querySelector("figure img") || article.querySelector("img");
      const body = article.querySelector(":scope > div") || article;
      const content = [];
      const heading = body.querySelector("h1, h2, h3, h4, h5, h6");
      if (heading) content.push(heading);
      [...body.children].forEach((child) => {
        if (child.contains(heading) || child.querySelector("a")) return;
        const text = child.textContent.trim();
        if (!text) return;
        const p = document.createElement("p");
        p.innerHTML = child.innerHTML;
        content.push(p);
      });
      body.querySelectorAll("a[href]").forEach((a) => {
        const text = a.textContent.trim();
        if (!text) return;
        const p = document.createElement("p");
        const link = document.createElement("a");
        link.href = a.getAttribute("href");
        link.textContent = text;
        p.append(link);
        content.push(p);
      });
      if (!img && !content.length) return;
      cells.push([img || "", content]);
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-promo", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/suresmile-cleanup.js
  var ORIGIN = "https://www.suresmile.com";
  var STEP_FALLBACK = {
    "Personalized consultation": "Your doctor will talk with you about your oral health goals and how teeth straightening can help. Your doctor will take photos and a digital scan, and you'll receive a consultation to see if SureSmile is right for you.",
    "Customized treatment plan": "Your doctor will prescribe a personal treatment plan that meets your unique needs and send it to the SureSmile digital lab.",
    "Starting treatment": "After your treatment plan is approved, your doctor will receive your aligners or other mode of treatment, and you\u2019ll return to the doctor to pick up supplies and go over instructions."
  };
  function getRscPayload(document) {
    let text = "";
    document.querySelectorAll("script").forEach((s) => {
      const t = s.textContent || "";
      if (t.includes("self.__next_f")) text += t;
    });
    if (!text) return "";
    return text.replace(/\\"/g, '"').replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">");
  }
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function lookupStepContent(payload, title) {
    if (payload) {
      const re = new RegExp(`"title":"${escapeRegExp(title)}","content":"((?:[^"\\\\]|\\\\.)*)"`);
      const m = payload.match(re);
      if (m && m[1]) {
        const value = m[1].replace(/<Footnote>[\s\S]*?<\/Footnote>/g, "").replace(/<[^>]+>/g, "").replace(/\\n/g, " ").replace(/\\(.)/g, "$1").trim();
        if (value) return value;
      }
    }
    return STEP_FALLBACK[title] || "";
  }
  function expandAccordions(element, document) {
    const payload = getRscPayload(document);
    element.querySelectorAll('h3 > button[id^="radix-"]').forEach((button) => {
      const h3 = button.parentElement;
      const panel = h3.nextElementSibling;
      if (!panel) return;
      [button, panel].forEach((el) => {
        el.removeAttribute("hidden");
        el.setAttribute("data-state", "open");
        el.removeAttribute("style");
      });
      button.setAttribute("aria-expanded", "true");
      if (panel.textContent.trim()) return;
      const spans = button.querySelectorAll("span");
      const title = spans.length ? spans[spans.length - 1].textContent.trim() : "";
      const content = title ? lookupStepContent(payload, title) : "";
      if (!content) return;
      const wrap = document.createElement("div");
      wrap.className = "mt-8";
      const p = document.createElement("p");
      p.textContent = content;
      wrap.append(p);
      panel.append(wrap);
    });
  }
  function resolveNextImage(src) {
    if (!src || !src.includes("/_next/image")) return src;
    try {
      const u = new URL(src, ORIGIN);
      const original = u.searchParams.get("url");
      if (!original) return src;
      return new URL(original, ORIGIN).href;
    } catch (e) {
      return src;
    }
  }
  function resolveImages(element) {
    element.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      const resolved = resolveNextImage(src);
      if (resolved !== src) img.setAttribute("src", resolved);
      img.removeAttribute("srcset");
      img.removeAttribute("srcSet");
      img.removeAttribute("sizes");
      img.removeAttribute("loading");
      img.removeAttribute("decoding");
      img.removeAttribute("data-nimg");
    });
    element.querySelectorAll("picture source").forEach((s) => s.remove());
  }
  function transform(hookName, element, payload) {
    const document = element.ownerDocument || payload.document;
    if (hookName === "beforeTransform") {
      expandAccordions(element, document);
      resolveImages(element);
      WebImporter.DOMUtils.remove(element, [
        "#onetrust-consent-sdk",
        "#onetrust-banner-sdk",
        "#onetrust-pc-sdk",
        ".onetrust-pc-dark-filter",
        "iframe.ot-text-resize",
        "header#header",
        ".header-io-marker",
        "footer.footer-base",
        'a[href="#main-content"]',
        ".blooth"
      ]);
      element.querySelectorAll("button").forEach((btn) => {
        const sr = btn.querySelector(".sr-only");
        if (sr && /^(previous|next) slide$/i.test(sr.textContent.trim())) btn.remove();
      });
    }
    if (hookName === "afterTransform") {
      element.querySelectorAll("header, footer, nav").forEach((el) => {
        if (!el.closest("form")) el.remove();
      });
      WebImporter.DOMUtils.remove(element, [
        "script",
        "style",
        "noscript",
        "iframe",
        "link",
        "template"
      ]);
      element.querySelectorAll("*").forEach((el) => {
        [...el.attributes].forEach((attr) => {
          const n = attr.name;
          if (n.startsWith("data-radix") || n.startsWith("data-gtm") || n.startsWith("data-analytics") || n.startsWith("data-track") || n === "data-state" || n === "data-orientation" || n === "data-value" || n === "onclick") {
            el.removeAttribute(n);
          }
        });
      });
    }
  }

  // tools/importer/transformers/suresmile-sections.js
  function findSection(root, selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (e) {
      }
    }
    return null;
  }
  function transform2(hookName, element, payload) {
    const document = element.ownerDocument || payload.document;
    const sections = payload && payload.template && payload.template.sections || [];
    if (sections.length < 2) return;
    if (hookName === "beforeTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        const el = findSection(element, section.selector);
        if (!el) continue;
        if (i === 0 && !section.style) continue;
        const hr = document.createElement("hr");
        if (section.style) hr.setAttribute("data-excat-section-id", section.id);
        if (i === 0) hr.setAttribute("data-excat-first-section", "true");
        el.before(hr);
      }
    }
    if (hookName === "afterTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        const marker = element.querySelector(`hr[data-excat-section-id="${section.id}"]`);
        if (section.style) {
          const anchor = findSection(element, section.selector) || marker;
          if (anchor) {
            const meta = WebImporter.Blocks.createBlock(document, {
              name: "Section Metadata",
              cells: { style: section.style }
            });
            anchor.after(meta);
          }
        }
        if (marker) marker.removeAttribute("data-excat-section-id");
      }
      element.querySelectorAll("hr[data-excat-first-section]").forEach((hr) => hr.remove());
    }
  }

  // tools/importer/import-find-a-doctor.js
  var PAGE_TEMPLATE = {
    "name": "find-a-doctor",
    "urls": [
      "https://www.suresmile.com/en-us/find-a-doctor"
    ],
    "representativeUrl": "https://www.suresmile.com/en-us/find-a-doctor",
    "description": "SureSmile find-a-doctor page: compact light-blue hero, doctor search bar, API-driven results list + map, Why straighten promo cards",
    "blocks": [
      {
        "name": "hero-split",
        "instances": [
          "section.section-hero .section-row"
        ]
      },
      {
        "name": "search-locator",
        "instances": [
          "section.doctor-search"
        ]
      },
      {
        "name": "search-results-map",
        "instances": [
          "section.doctor-body"
        ]
      },
      {
        "name": "cards-promo",
        "instances": [
          "#carousel-why-sureSmile + .carousel-container"
        ]
      }
    ],
    "urlPattern": "/en-us/*",
    "sections": [
      {
        "id": "rc1",
        "name": "Hero",
        "selector": [
          "section.section-hero"
        ],
        "style": "light-blue",
        "blocks": [
          "hero-split"
        ],
        "defaultContent": []
      },
      {
        "id": "rc2a",
        "name": "Doctor search bar",
        "selector": [
          "section.doctor-search"
        ],
        "style": "blue-gradient",
        "blocks": [
          "search-locator"
        ],
        "defaultContent": []
      },
      {
        "id": "rc2b",
        "name": "Doctor results and map",
        "selector": [
          "section.doctor-body"
        ],
        "style": "porcelain",
        "blocks": [
          "search-results-map"
        ],
        "defaultContent": []
      },
      {
        "id": "rc3",
        "name": "Why straighten with SureSmile",
        "selector": [
          "section:has(#carousel-why-sureSmile)"
        ],
        "style": null,
        "blocks": [
          "cards-promo"
        ],
        "defaultContent": [
          "#carousel-why-sureSmile"
        ]
      }
    ]
  };
  var parsers = {
    "hero-split": parse,
    "search-locator": parse2,
    "search-results-map": parse3,
    "cards-promo": parse4
  };
  var sectionTransformers = [transform2];
  var fragmentTransformers = [];
  var lateTransformers = [...sectionTransformers, ...fragmentTransformers];
  var transformers = [transform, ...lateTransformers];
  var earlyTransformers = transformers.filter((fn) => !lateTransformers.includes(fn));
  var CATALOG = Boolean(PAGE_TEMPLATE.pageCleanup || PAGE_TEMPLATE.blocks.some((b) => b.pageInstances));
  function executeTransformers(hookName, element, payload, list = transformers) {
    var _a, _b;
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), { template: ((_b = (_a = payload.params) == null ? void 0 : _a.targets) == null ? void 0 : _b.template) || PAGE_TEMPLATE });
    list.forEach((fn) => {
      try {
        fn(hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document, template, url) {
    const pageBlocks = [];
    const pageKey = (u) => {
      try {
        const { origin, pathname } = new URL(u);
        return `${origin}${pathname.replace(/\/$/, "")}`;
      } catch (e) {
        return u;
      }
    };
    const key = pageKey(url);
    const claim = (blockDef, selector) => {
      let matches = [];
      try {
        matches = document.querySelectorAll(selector);
      } catch (e) {
        return;
      }
      matches.forEach((element) => {
        if (pageBlocks.some((b) => b.element === element || b.element.contains(element) || element.contains(b.element))) return;
        pageBlocks.push({ name: blockDef.name, selector, element });
      });
    };
    template.blocks.forEach((blockDef) => {
      const entry = Object.entries(blockDef.pageInstances || {}).find(([u]) => pageKey(u) === key);
      (entry ? entry[1] : []).forEach((selector) => claim(blockDef, selector));
    });
    template.blocks.forEach((blockDef) => (blockDef.instances || []).forEach((selector) => claim(blockDef, selector)));
    return pageBlocks;
  }
  function markPageTargets(payload) {
    const { document, params } = payload;
    executeTransformers("beforeTransform", document.body, payload, earlyTransformers);
    const blocks = findBlocksOnPage(document, PAGE_TEMPLATE, params.originalURL).map(({ name, selector, element }, i) => {
      element.setAttribute("data-excat-block", String(i));
      return { name, selector };
    });
    const sections = (PAGE_TEMPLATE.sections || []).map((section, i) => {
      const target = (section.selector || []).map((s) => {
        try {
          return document.querySelector(s);
        } catch (e) {
          return null;
        }
      }).find(Boolean);
      if (!target) return section;
      target.setAttribute("data-excat-section", String(i));
      return __spreadProps(__spreadValues({}, section), { selector: [`[data-excat-section="${i}"]`] });
    });
    params.targets = { blocks, template: __spreadProps(__spreadValues({}, PAGE_TEMPLATE), { sections }) };
  }
  var import_find_a_doctor_default = {
    preprocess: (payload) => {
      if (CATALOG) markPageTargets(payload);
    },
    transform: (payload) => {
      const { document, url, params } = payload;
      const main = document.body;
      params.fragments = [];
      if (!params.targets) markPageTargets(payload);
      const pageBlocks = params.targets.blocks.map((block, i) => __spreadProps(__spreadValues({}, block), { element: document.querySelector(`[data-excat-block="${i}"]`) })).filter((block) => block.element);
      executeTransformers("beforeTransform", main, __spreadProps(__spreadValues({}, payload), { pageBlocks }), lateTransformers);
      pageBlocks.forEach((block) => {
        if (!main.contains(block.element)) return;
        const parser = parsers[block.name];
        if (!parser) return;
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      });
      executeTransformers("afterTransform", main, payload);
      main.appendChild(document.createElement("hr"));
      WebImporter.rules.createMetadata(main, document);
      WebImporter.rules.transformBackgroundImages(main, document);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      params.fragments.forEach(({ element }) => {
        executeTransformers("afterTransform", element, payload, earlyTransformers);
        WebImporter.rules.transformBackgroundImages(element, document);
        WebImporter.rules.adjustImageUrls(element, url, params.originalURL);
      });
      const rawPath = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);
      return [{
        element: main,
        path,
        report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) }
      }, ...params.fragments];
    }
  };
  return __toCommonJS(import_find_a_doctor_exports);
})();
