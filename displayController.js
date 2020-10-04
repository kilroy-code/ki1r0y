"use strict";
var Tree = require('./tree');

// TODO: Can adopt/resetDisplay be eliminated by instead using a declaritive mechanism for children?

class DisplayController extends Tree {
  display() { return ''; }
  update() { return this.childrenInitialized; }
  entity() { return null; }

  constructor(options) {
    super(options);
    this.display;
    process.nextTick(_ => this.update); // FIXME: can we do this without pulling process into the browser?
  }
  resetDisplay() { let old = this.display; this.display = undefined; return old; }
  adopt(entity) { this.resetDisplay(); this.entity = entity; return entity; }
}
DisplayController.register({
  ownEagerProperties: ['update'],
  nonRules: ['constructor', 'resetDisplay', 'adopt']
});
module.exports = DisplayController;
