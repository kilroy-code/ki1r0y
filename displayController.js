"use strict";
var Tree = require('./registerable');

class DisplayController extends Tree {
  entity() { return null; }
  display() { this.notImplemented('display'); }
  update() { this.notImplemented('update'); }
  resetDisplay() { let old = this.display; this.display = undefined; return old; }
  adopt(entity) { this.resetDisplay(); this.entity = entity; return entity; }
  constructor(options) {
    super(options);
    this.display;
    process.nextTick(_ => this.update);
  }
}
DisplayController.register({
  ownEagerProperties: ['update', 'display'],
  nonRules: ['constructor', 'resetDisplay', 'adopt']
});
module.exports = DisplayController;
