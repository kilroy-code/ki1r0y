"use strict";

var Rule = require('@kilroy-code/rules');
var Tree = require('./tree');

class Persistable extends Tree {
  static register(options = {}) {
    let {
      classFunction, prototype, ownRuleProperties,
      ownIdentityProperties = ownRuleProperties,
      identityProperties = this.combinedProperties(classFunction, 'identityProperties', ownIdentityProperties),
      ...otherOptions
    } = this.registrationOptions(options);
    super.register({prototype, ownRuleProperties, ...otherOptions});
    prototype.identityProperties = identityProperties;
  }

  // Configuration.
  static configure({store}) {
    this.store = store;
  }
  static _noStore() {
    console.error('Please provide Persistable.configure() with a store implementation.');
  }

  // Unpickling.
  static collectionName(idtag) {
    return 'unspecified';
  }
  static retrieveAndMerge(idtag, properties) {
    return this.store // A promise for the properties, produced by retrieving idtag from storage, and merging against remaining given properties.
      .retrieve(this.collectionName(idtag), idtag)
      .then(serialized => Object.assign(JSON.parse(serialized), properties)); // properties override retrieved ones.
  }
  static collectProperties(properties) { // Promise to inflate idtags by fetching and parsing the properties.
    var idtag;
    if (typeof properties === 'string') { // properties can be an idtag string....
      idtag = properties;
      properties = {};
    } else {                              // ... or an object.
      ({idtag, ...properties} = properties);
    }
    if (idtag === undefined) { // Property values may be promises, but constructor will assign to rules that can handle them.
      return super.collectProperties(properties);
    }
    // idtag may be a promise or not. Either way, we will retrive it asynchronously and promise to merge the given properties to what we retrieve.
    if (idtag.then) { return idtag.then(idtag => this.retrieveAndMerge(idtag, properties)); }
    return this.retrieveAndMerge(idtag, properties);
  }

  // Pickling.
  static isDefaultValueForType(value) { // Not an empty/default-initialized value
    if (!value && !isNaN(value)) { return true; }
    if (Array.isArray(value)) { return !value.length; }
    if (typeof value !== 'object') { return false; }
    return this._isEmptyObject(value);
  }
  static _isEmptyObject(obj) { // Much faster than !Object.keys(obj).length
    for (let x in obj) { return false; }
    return true;
  }
  type() {
    return this.constructor.name;
  }
  identitySpec() {
    return this._gatherProperties(this.identityProperties);
  }
  instancespec() {
    return this.savedId; // todo: generalize with gatherProperties and inputs
  } 
  savedId() {
    return this.constructor.store.save(this.collectionName,
                                       this.requestedIdForSaving,
                                       JSON.stringify(this.identitySpec));
  }
}
Persistable.store = { // No ES6 static properties in webpack yet.
  save: this._noStore,
  retrieve: this._noStore
};

Persistable.register({identityProperties: ['type', 'instancespecs']});
// These answer fixed values, and so they don't need to be computed by a method or Rule.
// But they are properties of an instance, and can be overridden with different values, or even by subclass rules.
// They're on prototype here instead of taking up space in each instance if they were set by the constructor.
Persistable.prototype.requestedIdForSaving = '';
Persistable.prototype.collectionName = 'unspecified';

// This is really a helper for savedId, which caches/tracks the value.
// It's arguable whether it's even worth separating it out.
Persistable.prototype._gatherProperties = function(keys) {
  // Answer a pojo of all key/values in self that are not default-initialized.
  let json = {}, constructor = this.constructor;
  for (let key of keys) {
    let value = this[key];
    if (!constructor.isDefaultValueForType(value)) {
      json[key] = value;
    }
  };
  return json;
};
module.exports = Persistable;
