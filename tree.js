"use strict";
var Rule = require('@kilroy-code/rules');
var Registerable = require('./registerable');

/*
First, a reminder about Rules and construction.
A rule computes and caches a value. This doesn't happen until the value is read.
An application can override the rule by assigning a specific value.
Values can be specified when instantiating, that override the rule (via Object.assign within the constructor).
An application can reset a rule by assigning undefined. 
  This will loose any previous computed or assigned value, and cause the original computation to be executed when the value is next read.
Any assignment (including reset) of a rule will reset all other rules whose currently computed value depends on it.
A Rulified array is one in which the length and numbered properties are tracked as rules, such that a change will reset rules the depend on them.
  (A direct change to the length or elements of the UNDERLYING array are not tracked.)
 */

/*
A Tree instance has a 'parent' rule (defaulting to null), and a 'children' rule that is a Rulified array.
Each of an instance's children has the instance as their parent.

An instance can have children added and removed with the 'addChild' and 'removeChild' methods, which maintain the parent/children invariant:
- These are methods on Tree instances, and take an argument that is a Tree instance. (They do not create a Tree from a spec elements, and do not resolve promises.)
- If the child argument to addChild already has the specified parent, no change is made. E.g., the order of children is preserved.
- Otherwise, if the child argument to addChild already has a parent, addChild will remove it by calling child.parent.removeChild(child).
  Note that this means that an instance can only appear once within children, in the order in which it was added, and that a child cannot be in two Trees.
- The methods may be extended by subclasses (e.g., to perform external side-effects as children are added and removed).
- A rule that depends on the mapping of children will be reset when a child is added or removed. 
  I.e., add/removeChild changes the length and the effected elements of the rulified array, so any rule that access them will be reset.
Discussion: The rules are designed to preserve the order of user interactions. One could imagine allowing the child argument to be a Promise,
in which case addChild/removeChild could add a 'then' that does the action, including checking/setting the parent. But this would make it
very difficult to preserve an ordering that the user could follow. Be careful, though, as making imperitive assignments to rules, or defining 
rules that explicitly use addChild/removeChild, can still have effects that are hard to reason about.

The 'parent' and 'children' properties may be specified when constructing a Tree instance.
- Rather than assigning these properties directly (which would set only parent or children, but not both), the constructor makes
  the appropriate addChild calls.
- This requires that property values are specified as objects, not specs with which to construct an object.
TODO: make this so for the children property. (It is already done for the parent property.)

A 'specs' property may be specified when constructing a Tree instance, that will result in children being created and added.
- The class 'create' method is called with each spec during construction, each of which may result in a promise.
- Each spec does not need to include the parent property (and typically should not).
- PROPOSED: Each spec element may optionally include a 'name' property, to be interpreted not as a property in the child,
  but rather assigning as a property in the parent, with the created child as the value. (Overriding any existing rule in the parent.)

A class can define a 'parts' rule that defines a list of Tree instances to always be included in children - i.e., the "compiled-in children", if any:
- The instances do not need to have parent defined (and typically should not). 
- 'parts' is an array of instances. (It does not create a Tree from spec elements.) Tree doesn't prescribe how they should be defined, 
  but they can be individually defined with named rules, with the 'parts' rule merely collecting them by reference into an array.
  Note that any such named Tree-instance rules may be overridden by properties given to the constructor (including named spec elements).
- TODO: allow 'parts' to be specified in 'specs', with all the right things happening.

A Tree has a 'childrenInitialized' rule whose value resolves to an ordinary (non-rulfified) Array containing all the resolved children. 
- By the time it is resolved, it has called addChild of each of the following, in order: 
  -- parts (if specified as a rule (TODO: or at construction)), 
  -- the results of resolving each element of specs (if specified at construction), 
  -- TODO: children (if specified at construction),
- The design decision of 'parts' first or 'specs' first is not entirely arbitrary. The Persistable subclass arranges to add all manually added
  children to the serialized specs, in the order that they were added. It is convenient to be able to rely on the rule-added parts coming first.
  FIXME: There should be a kind of 'specs' that the parent supplies, and a kind of 'specs' that the persistence provides. Do we need different names, or make constructor explicitly merge them?
- If the 'childrenInitialized' rule is reset (either directly or by resetting a dependency such as 'parts'), all of the existing children 
  are first removed (with removeChild). This ensures that on (re-)evaluation, the instance contains all and only the specified children.

Some differences between specs, parts, children, and childrenInitialized:
- 'specs' is a keyword in the constructor, not a rule. The rest are rules.
- 'parts' and 'childrenInitialized' are ordinary arrays. Calling addChild/removeChild will not alter or reset them, and directly altering either array will not reset the rule.
- 'children' is a rulified array: Any alteration (e.g., through addChild/removeChild) will reset rules that depends on those parts of the 'children' rule.

FIXME: 

- As an app adds and removes children:
  rules that depend on the 'children' property are reset as the application adds or removes children

- definedChildren are the rule-defined children, not including those that are added/removed interactively by an application
  parts and spec, in that order
  not resolved until each child is resolved and added [-- Do we need to find a way to replace a promise with it's resolved value within a rulified array element?]
  resets if parts are reset (i.e., requires parts)
  does not reset as children are interactively added and removed by the application (i.e., does not require children)
  if reset and re-demanded, keeps the definedChildren first by removing all children and then re-adding only the definedChildren
  [change name from childrenInitialized => definedChildren]
*/

class Tree extends Registerable {
  type() { // FIXME: Here for debugging. Normally in Persistable
    return this.constructor.name;
  }
  parent() {
    return null;
  }
  root() {
    if (!this.parent) { return this; }
    return this.parent.root;
  }
  children() {
    return Rule.rulify(this._internalRawChildren);
  }
  constructor({specs, parent, ...otherProperties} = {}) {
    super(otherProperties);
    // Prepare groundwork for childrenInitialized, but does not demand it.
    if (specs) {
      this._inputs = specs.map(spec => this.constructor.create(spec));
    }
    this._internalRawChildren = [];
    if (parent) parent.addChild(this);
  }
  parts() { 
    return [];
  }
  resolvedChildren() {
    // Removes any existing children,
    // Computes parts, waits for all specs and parts to resolve.
    let parts = this.parts.concat(this._inputs || []);
    return Promise.all(parts);
  }
  childrenInitialized() {
    let newChildren = this.resolvedChildren;

    this.eachChild(child => this.removeChild(child));
    newChildren.forEach(child => this.addChild(child));
    // If this resets, so should children. But if the parts of children reset (e.g., from add/removeChild), this should not.
    // This is accomplished by surgically removing the children rule that are being collected even as we execute this rule method.
    this.children = undefined; // resetting all dependencies... except us!
    let references = this._childrenInitialized._collectingReferences, childRule = this._children;
    for (let i = references.length; i--;) { // For speed, _collectingReferences doesn't dedupe, so gotta remove 'em all.
      if (references[i] === childRule) references.splice(i, 1);
    }
    
    return this._internalRawChildren.slice();
  }
}
Tree.register();

Tree.prototype.eachChild = function (iterator, self) {
  this._internalRawChildren.slice().forEach((child, index) => iterator.call(self, child, index, this));
}

Tree.prototype.addChild = function (child) {
  if (child.parent === this) return null; // Don't change order in children if already present.
  if (child.parent) { child.parent.removeChild(child); }
  child.parent = this;

  let children = this.children;
  children.push(child);
  return child;
};
Tree.prototype.removeChild = function (child) {
  if (child.parent !== this) return null; // Not an error.
  child.parent = undefined;

  let children = this.children;
  children.splice(children.indexOf(child), 1);
  return child;
};
module.exports = Tree;
