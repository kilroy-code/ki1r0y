"use strict";
var Registerable = require('./registerable');

class DisplayController extends Registerable {
  entity() { return null; }
  display() { throw new Error('Please provide your own implementation of display.'); }
  update() { throw new Error('Please provide your own implementation of update.'); }
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
