"use strict";
var Rule = require('@kilroy-code/rules');

// TODO: decorate classes with ruleProperties and nonRules, just like we do with
// eagerProperties (and references static class properties if defined), so that
// people don't have to list stuff that they are extending from supers, such as
// constructor. Include a comment that "...
//   It is hard to know how much "Do What I Mean" machinery to build in. Including too much
// causes application programming to be a matter of studying lore, and feels like overwhelming
// trickery to new or casual users of the framework. Here we use a form of the "true, kind, and
// necesary" criteria, in that subclasses shouldn't change the categorization of properties
// defined in superclasses, ommitting a declaration can be fatal and confusing (e.g., ommitting
// 'constructor' from the nonRules), and some properties may be created "under the hood" without
// explicitly being defined by the applciation writer (such as 'constructor').

class Registerable {
  static combinedProperties(classObject, propertyName, ownProperties) {
    let superclassObject = Object.getPrototypeOf(classObject),
        prototype = superclassObject.prototype;
    return prototype[propertyName].concat(ownProperties);
  }
  static registrationOptions({
    classFunction = this,
    // FIXME: It might be necessary to specify name explicitly when minifying.
    // See https://croquet-dev.slack.com/archives/CKMUHFXUG/p1594826645024400
    name = classFunction.name,
    prototype = classFunction.prototype,
    nonRules = ['constructor'],
    ownRuleProperties = Object.getOwnPropertyNames(prototype).filter(name => !nonRules.includes(name) && !name.startsWith('_')),
    ownEagerProperties = [],
    eagerProperties = this.combinedProperties(classFunction, '_eagerProperties', ownEagerProperties),
    ...otherOptions
  } = {}) {
    return {classFunction, name, prototype, nonRules, ownRuleProperties, ownEagerProperties, eagerProperties, ...otherOptions};
  }
  static register(options = {}) {
    let {classFunction, name, prototype, ownRuleProperties, eagerProperties} = this.registrationOptions(options);
    prototype._eagerProperties = eagerProperties; // So that subclasses can find it.
    Rule.rulify(prototype, ownRuleProperties, eagerProperties); // List all eagerProperties so that any redefinitions are also eager.
    classFunction.types[name] = classFunction;
  }
  constructor({type, ...propertiesWithoutType} = {}) {
    if (type && (type !== this.constructor.name)) { // Dispatch to the proper type.
      const constructor = this.constructor.types[type];
      if (!constructor) throw new TypeError(`Cannot construct unregistered type ${type}.`);
      return new constructor(propertiesWithoutType);
    }
    Object.assign(this, propertiesWithoutType); // Subtle: uses setters on this, which will evaluate/track rules.
  }
  static create(properties = {}) { // Promise to collect and construct.
    return this.collectProperties(properties).then(collected => new this(collected));
  }
  static collectProperties(properties) { // Can be overridden to process properties, as by Persistable.
    return Promise.resolve(properties);
  }
}
Registerable.types = {[Registerable]: Registerable}; // No ES6 static properties in webpack yet.
Registerable.prototype._eagerProperties = [];

module.exports = Registerable;
