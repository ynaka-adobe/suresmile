/* eslint-disable */
/* global WebImporter */

import heroSplitParser from './parsers/hero-split.js';
import cardsCalloutsParser from './parsers/cards-callouts.js';
import cardsPromoParser from './parsers/cards-promo.js';
import accordionStepperParser from './parsers/accordion-stepper.js';
import columnsMediaParser from './parsers/columns-media.js';
import searchLocatorParser from './parsers/search-locator.js';
import cardsBeforeafterParser from './parsers/cards-beforeafter.js';
import cleanupTransformer from './transformers/suresmile-cleanup.js';
import sectionsTransformer from './transformers/suresmile-sections.js';

const PAGE_TEMPLATE = {
  "name": "home",
  "urls": [
    "https://www.suresmile.com/en-us"
  ],
  "representativeUrl": "https://www.suresmile.com/en-us",
  "description": "SureSmile homepage: split hero, treatment strip, promo cards, how-it-works stepper, media columns, doctor locator and before/after transformations",
  "urlPattern": "/*",
  "blocks": [
    {
      "name": "hero-split",
      "instances": [
        "section.section-hero .section-row"
      ]
    },
    {
      "name": "cards-callouts",
      "instances": [
        "section.section-marquee .section-row"
      ]
    },
    {
      "name": "cards-promo",
      "instances": [
        "#carousel-why-sureSmile + .carousel-container"
      ]
    },
    {
      "name": "accordion-stepper",
      "instances": [
        "section:has(.bg-gradient-progress) .section-row > div.flex.flex-row.relative"
      ]
    },
    {
      "name": "columns-media",
      "instances": [
        "section.bg-blues-93 .section-row",
        "section:not(.bg-blues-93):has(.section-row > div.flex.items-center.justify-center + .text-section h2) .section-row",
        "section.bg-oranges-90:not(.section-hero) .section-row"
      ]
    },
    {
      "name": "search-locator",
      "instances": [
        "section.section-cta section:has(form)"
      ]
    },
    {
      "name": "cards-beforeafter",
      "instances": [
        "#carousel-real-transformations + .carousel-container"
      ]
    }
  ],
  "sections": [
    {
      "id": "rc1",
      "name": "Hero",
      "selector": [
        "section.section-hero"
      ],
      "style": "light-orange",
      "blocks": [
        "hero-split"
      ],
      "defaultContent": []
    },
    {
      "id": "rc2",
      "name": "Treatment types strip",
      "selector": [
        "section.section-marquee"
      ],
      "style": "blue-gradient",
      "blocks": [
        "cards-callouts"
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
    },
    {
      "id": "rc4",
      "name": "How it works",
      "selector": [
        "section:has(.bg-gradient-progress)"
      ],
      "style": "split",
      "blocks": [
        "accordion-stepper"
      ],
      "defaultContent": [
        "section:has(.bg-gradient-progress) .section-row .text-section h2",
        "section:has(.bg-gradient-progress) .section-row:nth-of-type(2) a"
      ]
    },
    {
      "id": "rc5",
      "name": "Dentsply Sirona backing",
      "selector": [
        "section.bg-blues-93"
      ],
      "style": "light-blue",
      "blocks": [
        "columns-media"
      ],
      "defaultContent": []
    },
    {
      "id": "rc6",
      "name": "What about braces",
      "selector": [
        "section:not(.bg-blues-93):has(.section-row > div.flex.items-center.justify-center + .text-section h2)",
        "#main-content > div.min-h-screen > section:nth-of-type(6)"
      ],
      "style": null,
      "blocks": [
        "columns-media"
      ],
      "defaultContent": []
    },
    {
      "id": "rc7",
      "name": "Find a doctor",
      "selector": [
        "section.section-cta"
      ],
      "style": "blue-gradient, split",
      "blocks": [
        "search-locator"
      ],
      "defaultContent": [
        "section.section-cta .section-row > img",
        "section.section-cta .section-row > .text-section h2"
      ]
    },
    {
      "id": "rc8",
      "name": "1 million patients",
      "selector": [
        "section.bg-oranges-90:not(.section-hero)"
      ],
      "style": "light-orange",
      "blocks": [
        "columns-media"
      ],
      "defaultContent": []
    },
    {
      "id": "rc9",
      "name": "Real transformations",
      "selector": [
        "section:has(#carousel-real-transformations)"
      ],
      "style": null,
      "blocks": [
        "cards-beforeafter"
      ],
      "defaultContent": [
        "#carousel-real-transformations",
        "section:has(#carousel-real-transformations) > div > .section-row a"
      ]
    }
  ]
};

const parsers = {
  'hero-split': heroSplitParser,
  'cards-callouts': cardsCalloutsParser,
  'cards-promo': cardsPromoParser,
  'accordion-stepper': accordionStepperParser,
  'columns-media': columnsMediaParser,
  'search-locator': searchLocatorParser,
  'cards-beforeafter': cardsBeforeafterParser,
};
// Late transformers change the DOM (section <hr> markers, shared fragments), so their beforeTransform
// runs after block discovery.
const sectionTransformers = [sectionsTransformer];
const fragmentTransformers = [];
const lateTransformers = [...sectionTransformers, ...fragmentTransformers];
const transformers = [cleanupTransformer, ...lateTransformers];
const earlyTransformers = transformers.filter((fn) => !lateTransformers.includes(fn));
// Catalog selectors (pageInstances, pageCleanup) count the <script> and <hr> elements the importer
// removes before transform, so a catalog template finds its targets in preprocess.
const CATALOG = Boolean(PAGE_TEMPLATE.pageCleanup || PAGE_TEMPLATE.blocks.some((b) => b.pageInstances));

function executeTransformers(hookName, element, payload, list = transformers) {
  const enhancedPayload = { ...payload, template: payload.params?.targets?.template || PAGE_TEMPLATE };
  list.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template, url) {
  const pageBlocks = [];
  const pageKey = (u) => {
    try { const { origin, pathname } = new URL(u); return `${origin}${pathname.replace(/\/$/, '')}`; }
    catch { return u; }
  };
  const key = pageKey(url);
  const claim = (blockDef, selector) => {
    let matches = [];
    try { matches = document.querySelectorAll(selector); } catch { return; }
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

// Runs the early transformers, then marks each block and section target with an attribute: the
// importer re-creates the body before transform, so only attributes survive, not element references.
function markPageTargets(payload) {
  const { document, params } = payload;
  executeTransformers('beforeTransform', document.body, payload, earlyTransformers);
  const blocks = findBlocksOnPage(document, PAGE_TEMPLATE, params.originalURL).map(({ name, selector, element }, i) => {
    element.setAttribute('data-excat-block', String(i));
    return { name, selector };
  });
  const sections = (PAGE_TEMPLATE.sections || []).map((section, i) => {
    const target = (section.selector || []).map((s) => { try { return document.querySelector(s); } catch { return null; } }).find(Boolean);
    if (!target) return section;
    target.setAttribute('data-excat-section', String(i));
    return { ...section, selector: [`[data-excat-section="${i}"]`] };
  });
  params.targets = { blocks, template: { ...PAGE_TEMPLATE, sections } };
}

export default {
  preprocess: (payload) => {
    if (CATALOG) markPageTargets(payload);
  },
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;
    params.fragments = [];

    if (!params.targets) markPageTargets(payload);
    const pageBlocks = params.targets.blocks
      .map((block, i) => ({ ...block, element: document.querySelector(`[data-excat-block="${i}"]`) }))
      .filter((block) => block.element);
    executeTransformers('beforeTransform', main, { ...payload, pageBlocks }, lateTransformers);

    pageBlocks.forEach((block) => {
      if (!main.contains(block.element)) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // A fragment's nodes left `main` before afterTransform: finalize it the same way, without the
    // page-only section breaks and metadata.
    params.fragments.forEach(({ element }) => {
      executeTransformers('afterTransform', element, payload, earlyTransformers);
      WebImporter.rules.transformBackgroundImages(element, document);
      WebImporter.rules.adjustImageUrls(element, url, params.originalURL);
    });

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }, ...params.fragments];
  },
};
