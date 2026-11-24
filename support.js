/* Runtime mini untuk <x-dc>, <sc-for>, <sc-if>, {{ekspresi}}, DCLogic */
(function () {
  class DCLogic {
    constructor(rerender) { this.state = {}; this._rerender = rerender; }
    setState(patch) { this.state = Object.assign({}, this.state, patch); this._rerender(); }
  }
  window.DCLogic = DCLogic;

  const EXPR = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const WHOLE = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/;

  function lookup(path, scope) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  }
  function interp(str, scope) {
    return str.replace(EXPR, (_, p) => {
      const v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }

  function build(node, scope, parent) {
    if (node.nodeType === 3) {
      parent.appendChild(document.createTextNode(interp(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();

    if (tag === 'sc-for') {
      const m = WHOLE.exec(node.getAttribute('list') || '');
      const list = (m && lookup(m[1], scope)) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => {
        const s = Object.create(scope);
        s[as] = item; s.index = i;
        node.childNodes.forEach((c) => build(c, s, parent));
      });
      return;
    }
    if (tag === 'sc-if') {
      const m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && lookup(m[1], scope)) node.childNodes.forEach((c) => build(c, scope, parent));
      return;
    }

    const el = node.namespaceURI === 'http://www.w3.org/1999/xhtml' ? document.createElement(tag) : document.createElementNS(node.namespaceURI, node.localName);
    for (const a of node.attributes) {
      if (a.name.startsWith('hint-placeholder')) continue;
      const whole = WHOLE.exec(a.value);
      if (/^on/i.test(a.name) && whole) {
        const fn = lookup(whole[1], scope);
        if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn);
      } else {
        el.setAttribute(a.name, interp(a.value, scope));
      }
    }
    node.childNodes.forEach((c) => build(c, scope, el));
    parent.appendChild(el);
  }

  function init() {
    const root = document.querySelector('x-dc');
    const script = document.querySelector('script[data-dc-script]');
    if (!root || !script) return;

    // <helmet> -> <head>
    const helmet = root.querySelector('helmet');
    if (helmet) {
      Array.from(helmet.children).forEach((c) => document.head.appendChild(c));
      helmet.remove();
    }

    const template = document.createElement('div');
    while (root.firstChild) template.appendChild(root.firstChild);

    const Component = new Function('DCLogic', script.textContent + '\nreturn Component;')(DCLogic);
    const logic = new Component(render);
    if (!logic.state) logic.state = {};

    function render() {
      const y = window.scrollY;
      const vals = logic.renderVals();
      const frag = document.createDocumentFragment();
      template.childNodes.forEach((c) => build(c, vals, frag));
      root.replaceChildren(frag);
      window.scrollTo(0, y);
    }
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
