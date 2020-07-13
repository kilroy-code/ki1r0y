"use strict";
var Rule = require('@kilroy-code/rules');
var Registerable = require('./registerable');

class Tree extends Registerable {
  parent() {
    return null;
  }
  root(self) {
    if (!this.parent) { return self; }
    return this.parent.root;
  }
  children() {
    return Rule.rulify([]); // A rulified array so that changes to length are tracked.
  }
  instancespec() {
    this.notImplemented('instancespec');
  } 
  instancespecs() {
    return this.children.map(child => child.instancespec);
  }
  constructor({instancespecs = [], parent, ...otherProperties} = {}) {
    super(otherProperties);
    if (parent) {
      parent.addChild(this);
    }
    if (!instancespecs.length) { return; }
    this.children = Promise.all(instancespecs.map(instancespec => this.constructor.create(instancespec)))
      .then(children => Rule.rulify(children.map(child => this.addChild(child))));
  }
}
Tree.register();
Tree.prototype._prepareToAddChild = function (child) {
  child.parent = this;
  return child;
};
Tree.prototype.addChild = function (child) {
  if (child.parent) { child.parent.removeChild(child); }
  this._prepareToAddChild(child);
  if (!this.children.then) {
    // Subtle: If this.children is a promise, someone else is responsible for making sure it contains
    // each added child by the time it resolves. This happens when the constructor promises to
    // create the instancespecs.
    this.children.push(child);
  }
  return child;
}
Tree.prototype.removeChild = function (child) {
  let index = this.children.indexOf(child);
  if (index < 0) { return false; }
  child.parent = undefined;
  this.children.splice(index, 1);
  return child;
}
module.exports = Tree;
