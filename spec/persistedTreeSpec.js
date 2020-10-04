"use strict";
var Persistable = require('../persistable');

class InMemoryStore {
  constructor() {
    this.db = {unspecified: {}};
  }
  save(collection, requestedId, string) {
    // A real implementation would probably hash string, or a counter.
    let id = requestedId || Math.random().toString();
    this.db[collection][id] = string;
    return Promise.resolve(id);
  }
  retrieve(collection, id) {
    return Promise.resolve(this.db[collection][id]);
  }
}

describe('PersistedTree', function () {
  class Node extends Persistable {
    name(self) { return ''; }
  }
  beforeAll(function () {
    Node.register();
    Persistable.configure({store: new InMemoryStore});
  });
  describe('example', function () {
    it('restores what it saves, and responds to change.', async function (done) {

      let root = new Node({name: 'root'});
      let child = root.addChild(new Node({name: 'a'}));
      root.addChild(new Node({name: 'b'}));
      let grandchild = child.addChild(new Node({name: 'a1'}));
      child.addChild(new Node({name: 'a2'}));
      
      function checkTrees(a, b) {
        expect(b.name).toBe(a.name);
        for (let i = 0; i < a.children.length; i++) {
          let childA = a.children[i], childB = b.children[i];
          checkTrees(childA, childB);
        }
      }
      async function restoreAndCheck(root) {
        let idtag = root.savedId;
        let restored = await Persistable.create({idtag: idtag});
        await restored.savedId;
        checkTrees(root, restored);
      }
      await restoreAndCheck(root);

      root.name = 'rootModified';
      child.name = 'aModified';
      grandchild.name = 'a1Modified';
      restoreAndCheck(root);
      done();
    });
  });
});
