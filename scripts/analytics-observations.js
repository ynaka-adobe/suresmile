export function scrollPosition() {
  const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  const distance = Math.max(0, height - window.innerHeight);
  return {
    current: distance === 0 ? 100
      : Math.round(Math.min(1, Math.max(0, window.scrollY / distance)) * 100),
    wholePageVisible: distance === 0,
  };
}

/** Local diagnostics only: no SDK, data layer, URLs, form values or storage. */
export default function createObservations(onChange) {
  let running = false;
  let intersection;
  let mutation;
  let resize;
  let frame;
  let sequence = 0;
  let identities = new WeakMap();
  let registered = new WeakSet();
  let visible = new WeakSet();
  let seen = new Map();
  let records = [];
  let links = [];
  let total = 0;
  let sightings = 0;
  let clicks = 0;
  let scroll = { current: 0, maximum: 0, wholePageVisible: false };
  const visibilityAvailable = typeof IntersectionObserver === 'function';

  function emit(type, detail) {
    if (!running) return;
    total += 1;
    records.push({ type, ...detail, time: Date.now() });
    records = records.slice(-30);
    onChange();
  }
  function measureScroll() {
    frame = undefined;
    if (!running) return;
    const position = scrollPosition();
    const maximum = Math.max(scroll.maximum, position.current);
    if (position.current === scroll.current && maximum === scroll.maximum
      && position.wholePageVisible === scroll.wholePageVisible) return;
    scroll = { ...position, maximum };
    emit('scroll', { ...scroll });
  }
  function scheduleScroll() {
    if (!frame && running) frame = window.requestAnimationFrame(measureScroll);
  }
  function register(block) {
    if (!intersection || registered.has(block)
      || !block.matches('main .block[data-block-name][data-block-status="loaded"]')
      || !/^[a-z][a-z0-9-]{0,47}$/.test(block.dataset.blockName)) return false;
    if (!identities.has(block)) {
      sequence += 1;
      identities.set(block, { id: sequence, name: block.dataset.blockName });
    }
    registered.add(block);
    intersection.observe(block);
    return true;
  }
  function discover(root) {
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    let changed = root.nodeType === Node.ELEMENT_NODE && register(root);
    root.querySelectorAll('.block[data-block-name]').forEach((block) => {
      changed = register(block) || changed;
    });
    if (changed) scheduleScroll();
  }
  function unregister(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    [root, ...root.querySelectorAll('.block[data-block-name]')].forEach((block) => {
      if (!registered.has(block)) return;
      intersection?.unobserve(block);
      registered.delete(block);
      visible.delete(block);
    });
  }
  return {
    start() {
      if (running) return;
      running = true;
      const position = scrollPosition();
      scroll = { ...position, maximum: position.current };
      if (visibilityAvailable) {
        intersection = new IntersectionObserver((entries) => {
          if (!running) return;
          entries.forEach((entry) => {
            const qualifies = entry.isIntersecting && entry.intersectionRatio >= 0.1;
            if (!qualifies) { visible.delete(entry.target); return; }
            if (visible.has(entry.target)) return;
            visible.add(entry.target);
            const component = identities.get(entry.target);
            if (!component) return;
            const repeat = seen.has(component.id);
            seen.set(component.id, component);
            sightings += 1;
            emit('componentSeen', { component, repeat });
          });
        }, { threshold: [0, 0.1] });
      }
      mutation = new MutationObserver((changes) => {
        if (!running) return;
        changes.forEach((change) => {
          if (change.type === 'attributes') discover(change.target);
          change.removedNodes.forEach(unregister);
          change.addedNodes.forEach(discover);
        });
      });
      mutation.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-block-status', 'data-block-name'],
      });
      discover(document);
      if (typeof ResizeObserver === 'function') {
        resize = new ResizeObserver(scheduleScroll);
        resize.observe(document.documentElement);
        resize.observe(document.body);
      }
      window.addEventListener('scroll', scheduleScroll, { passive: true });
      window.addEventListener('resize', scheduleScroll);
      onChange();
    },
    stop() {
      running = false;
      intersection?.disconnect();
      mutation?.disconnect();
      resize?.disconnect();
      window.removeEventListener('scroll', scheduleScroll);
      window.removeEventListener('resize', scheduleScroll);
      if (frame) window.cancelAnimationFrame(frame);
      frame = undefined;
      sequence = 0;
      identities = new WeakMap();
      registered = new WeakSet();
      visible = new WeakSet();
      seen = new Map();
      records = [];
      links = [];
      total = 0;
      sightings = 0;
      clicks = 0;
      scroll = { current: 0, maximum: 0, wholePageVisible: false };
    },
    link(description) {
      if (!running) return;
      clicks += 1;
      links.push({ ...description });
      links = links.slice(-30);
      emit('linkClick', { link: description });
    },
    snapshot() {
      return {
        active: running,
        visibilityAvailable,
        totalEvents: total,
        sightings,
        clicks,
        components: [...seen.values()],
        links: [...links],
        scroll: { ...scroll },
        records: [...records],
      };
    },
  };
}
