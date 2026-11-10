/* eslint-disable */
/* global WebImporter */

/**
 * SureSmile sections transformer.
 * beforeTransform: inserts <hr> section breaks (reverse order) while the source
 * sections still exist; styled sections get a temporary data-excat-section-id marker.
 * afterTransform: adds Section Metadata blocks for styled sections and removes markers.
 */

function findSection(root, selectors) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of list) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector in this environment, try next
    }
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const document = element.ownerDocument || payload.document;
  const sections = (payload && payload.template && payload.template.sections) || [];
  if (sections.length < 2) return;

  if (hookName === 'beforeTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSection(element, section.selector);
      if (!el) continue;
      if (i === 0 && !section.style) continue;
      const hr = document.createElement('hr');
      if (section.style) hr.setAttribute('data-excat-section-id', section.id);
      if (i === 0) hr.setAttribute('data-excat-first-section', 'true');
      el.before(hr);
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const marker = element.querySelector(`hr[data-excat-section-id="${section.id}"]`);
      if (section.style) {
        const anchor = findSection(element, section.selector) || marker;
        if (anchor) {
          const meta = WebImporter.Blocks.createBlock(document, {
            name: 'Section Metadata',
            cells: { style: section.style },
          });
          anchor.after(meta);
        }
      }
      if (marker) marker.removeAttribute('data-excat-section-id');
    }
    element.querySelectorAll('hr[data-excat-first-section]').forEach((hr) => hr.remove());
  }
}
