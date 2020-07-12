"use strict";
var Rule = require('@kilroy-code/rules');
var Persistable = require('./persistable');

class Tree extends Persistable {
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
    return this.savedId; // todo: generalize with gatherProperties and inputs
  } 
  instancespecs() {
    return this.children.map(child => child.instancespec);
  }
  constructor({instancespecs = [], ...otherProperties} = {}) {
    super(otherProperties);
    if (!instancespecs.length) { return; }
    let classFunction = this.constructor;

    let inspect = require('util').inspect;
    this.children = Promise.all(instancespecs.map(instancespec => classFunction.create(instancespec)))
      .then(children => Rule.rulify(children.map(child => this._prepareToAddChild(child))));
  }
}
Tree.register({ownIdentityProperties: ['instancespecs']});
Tree.prototype._prepareToAddChild = function (child) {
  child.parent = this;
  return child;
};
Tree.prototype.addChild = function (child) {
  if (child.parent) { child.parent.removeChild(child); }
  this._prepareToAddChild(child);
  this.children.push(child);
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
