"use strict";

var inspect = require('util').inspect; // fixme dev only
var Tree = require('../tree');
var DisplayController = require('../displayController');

class DomController extends DisplayController {
  tagName() {
    return this.constructor.name; // document.createElement will lowercase
  }
  display() {
    return document.createElement(this.tagName);
  }
  toString() {
    return `[${this.tagName}]`;
  }
  addChild(...args) {
    let child = super.addChild(...args);
    if (child) this.display.append(child.display);
    return child;
  }
  removeChild(...args) {
    let child = super.removeChild(...args);
    if (child) child.display.remove();
    return child;
  }
}
class Document extends DomController {
  display() {
    return new Promise(resolve => {
      if (document.body) { return resolve(document.body); }
      window.addEventListener('load', _ => {
        console.log('loaded document.body', document.body, this);
        return resolve(document.body); });
        });
  }
}
[DomController, Document].forEach(c => c.register({
  nonRules: ['constructor', 'addChild', 'removeChild', 'toString'],
}));


class TextElement extends DomController {
  text() { return ''; }
  toString() {
    return `[${this.tagName}${this.text ? ' ' : ''}${this.text}]`;
  }
  update() {
    this.display.textContent = this.text;
    return super.__update();
  }
}
class H1 extends TextElement {}
class H2 extends TextElement {}
class P extends TextElement {}
class Section extends DomController {
  h() { return new H1({text: this.entity.title}); }
  p() { return new P({text: this.entity.description}); }
  entitySections() {
    return this.entity.children.map(child => new Section({entity: child}));
  }
  parts() {
    return [this.h, this.p].concat(this.entitySections);
  }
}
[TextElement, H1, H2, P, Section].forEach(c => c.register({
  nonRules: ['constructor', 'toString']
}));

class Node extends Tree {
  title() { return ''; }
  description() { return ''; }
  toString() { return `[${this.constructor.name} ${this.title}]`; }
}
Node.register({
  nonRules: ['constructor', 'toString'],
});

let root = new Node({
  title: "How to Fish",
  specs: [
    {type: 'Node', title: "Introduction", description: "People have been catching fish for food since before recorded history..."},
    {type: 'Node', title: "Equipment", description: "The first thing you'll need is a fishing rod or pole that you find comfortable and is strong enough for the kind of fish you're expecting to land..."}
  ]});

Document.body = new Document({
  specs: [{type: 'Section', entity: root}]
});

module.exports = {Node, Section, P, H1, H2, TextElement, Document, DomController, root};
root.childrenInitialized.then(children => module.exports.intro = children[0]);
// example: in console, we want this to recompute k.rootSection.children and k.introSection.parent (but it doesn't yet)
// k.root.removeChild(k.intro)


/*
describe('Dom', function () {
  describe('Suite A', function () {
    it('has successful test.', function () {
      expect(true).toBeTruthy();
    });
  });
});
*/

