/*
 * Sidekick palette: audiences on the page being edited.
 * Lists each section that declares "Audience: <name>" rows (with the variant document each one
 * swaps in), and opens the page as a simulated visitor, so authors can see every variant
 * without being in that country or having viewed that journey.
 *
 * The Sidekick passes the page being edited as ?referrer= (config: passReferrer).
 */

const params = new URLSearchParams(window.location.search);

function hostUrl() {
  const candidates = [params.get('referrer'), document.referrer];
  for (let i = 0; i < candidates.length; i += 1) {
    try {
      if (candidates[i]) return new URL(candidates[i]);
    } catch { /* try the next candidate */ }
  }
  return new URL(window.location.href);
}

const host = hostUrl();

function navigate(url) {
  try {
    window.top.location.href = url.toString();
  } catch {
    window.open(url.toString(), '_top');
  }
}

function plainPath(url) {
  const path = url.pathname.endsWith('/') ? `${url.pathname}index` : url.pathname;
  return `${url.origin}${path.replace(/\.html$/, '')}.plain.html`;
}

function sectionLabel(section, index) {
  const heading = section.querySelector('h1, h2, h3');
  if (heading) return heading.textContent.trim().slice(0, 60);
  const block = section.querySelector('[class]:not(.section-metadata)');
  return block ? `${block.className.split(' ')[0]} (section ${index + 1})` : `Section ${index + 1}`;
}

/** @returns {Promise<{label: string, audiences: {name: string, variant: string}[]}[]>} */
async function readAudienceSections() {
  const response = await fetch(plainPath(host));
  if (!response.ok) throw new Error(`Page returned ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  const sections = [...doc.querySelectorAll('body > div, main > div')];
  return sections.map((section, index) => {
    const audiences = [...section.querySelectorAll('.section-metadata > div')]
      .map((row) => {
        const [key, value] = [...row.children];
        const match = /^audience\s*[:-]?\s*(.+)$/i.exec((key?.textContent || '').trim());
        if (!match) return null;
        const link = value?.querySelector('a');
        const variant = link ? new URL(link.getAttribute('href'), host).pathname
          : (value?.textContent || '').trim();
        return { name: match[1].trim().toLowerCase().replace(/\s+/g, '-'), variant };
      })
      .filter(Boolean);
    return { label: sectionLabel(section, index), audiences };
  }).filter((entry) => entry.audiences.length);
}

function previewUrl(changes) {
  const url = new URL(host.href);
  ['audience', 'country', 'interest'].forEach((key) => url.searchParams.delete(key));
  Object.entries(changes).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set('insights', '1');
  return url;
}

function render(entries) {
  const list = document.getElementById('aud-list');
  list.replaceChildren();
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'aud-note';
    li.textContent = 'No section on this page declares an Audience.';
    list.append(li);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'aud-item';
    const title = document.createElement('p');
    title.className = 'aud-item-section';
    title.textContent = entry.label;
    item.append(title);
    entry.audiences.forEach((audience) => {
      const row = document.createElement('div');
      row.className = 'aud-row';
      const name = document.createElement('span');
      name.className = 'aud-name';
      name.textContent = audience.name;
      const variant = document.createElement('span');
      variant.className = 'aud-variant';
      variant.textContent = audience.variant;
      variant.title = audience.variant;
      const view = document.createElement('button');
      view.type = 'button';
      view.textContent = 'Preview';
      view.addEventListener('click', () => navigate(previewUrl({ audience: audience.name })));
      row.append(name, variant, view);
      item.append(row);
    });
    const def = document.createElement('div');
    def.className = 'aud-row';
    const label = document.createElement('span');
    label.textContent = 'Default content';
    const show = document.createElement('button');
    show.type = 'button';
    show.className = 'aud-secondary';
    show.textContent = 'Preview';
    show.addEventListener('click', () => navigate(previewUrl({ audience: 'default' })));
    def.append(label, show);
    item.append(def);
    list.append(item);
  });
}

(async function init() {
  document.getElementById('aud-page').textContent = `${host.origin}${host.pathname}`;
  const country = document.getElementById('aud-country');
  const interest = document.getElementById('aud-interest');
  country.value = host.searchParams.get('country') || '';
  interest.value = host.searchParams.get('interest') || '';
  document.getElementById('aud-apply').addEventListener('click', () => {
    navigate(previewUrl({ country: country.value, interest: interest.value }));
  });
  document.getElementById('aud-reset').addEventListener('click', () => {
    const url = previewUrl({});
    url.searchParams.set('country', 'NONE');
    url.searchParams.set('interest', 'none');
    navigate(url);
  });
  const status = document.getElementById('aud-status');
  try {
    const entries = await readAudienceSections();
    status.textContent = entries.length
      ? `${entries.length} section${entries.length === 1 ? '' : 's'} with audiences.`
      : '';
    render(entries);
  } catch (e) {
    status.textContent = `Could not read the page: ${e.message}`;
  }
}());
