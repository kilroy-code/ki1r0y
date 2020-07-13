"use strict";
var Rule = require('@kilroy-code/rules');

class Registerable {
  static combinedProperties(classObject, propertyName, ownProperties) {
    let superclassObject = Object.getPrototypeOf(classObject),
        prototype = superclassObject.prototype;
    return prototype[propertyName].concat(ownProperties);
  }
  static registrationOptions({
    classFunction = this,
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
      if (!constructor) throw new TypeError(`Cannot create unregistered type ${type}.`);
      return new constructor(propertiesWithoutType);
    }
    Object.assign(this, propertiesWithoutType); // Subtle: uses setters on this.
  }
  static create(properties = {}) { // Promise to collect and construct.
    return this.collectProperties(properties).then(collected => new this(collected));
  }
  static collectProperties(properties) {
    return Promise.resolve(properties);
  }
  notImplemented(label) {
    throw new ReferenceError(`Please provide an implementation for rule ${label}.`);
  }
}
Registerable.types = {[Registerable]: Registerable}; // No ES6 static properties in webpack yet.
Registerable.prototype._eagerProperties = [];

module.exports = Registerable;
