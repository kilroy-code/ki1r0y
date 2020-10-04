"use strict";
var Tree = require('../tree');
var Rule = require('@kilroy-code/rules'); // fixme

describe('Tree', function () {
  describe('addChild and removeChild', function () {
    it('return the child.', function () {
      let parent = new Tree(), child = new Tree();
      expect(parent.addChild(child)).toBe(child);
      expect(parent.removeChild(child)).toBe(child);
    });
    it('is no-op if already added, preserving order.', function () {
      let parent = new Tree(), child1 = new Tree(), child2 = new Tree();
      parent.addChild(child1);
      parent.addChild(child2);
      parent.addChild(child1);
      let children = parent.children;
      expect(children).toEqual([child1, child2]);
    });
    it('calls removeChild when addChild is called with a child already parented to another.', function () {
      let parent1 = new Tree(), parent2 = new Tree(), child = new Tree();
      parent1.addChild(child);
      expect(child.parent).toBe(parent1);      
      parent2.addChild(child);
      expect(child.parent).toBe(parent2);

      expect(parent1.children).toEqual([]);

      expect(parent2.children).toEqual([child]);
    });
    it('is no-op if already removed, not an error.', function () {
      let parent = new Tree(), child1 = new Tree();
      parent.addChild(child1);
      parent.removeChild(child1);
      parent.removeChild(child1);      
      expect(parent.children).toEqual([]);
    });
    it('can be extended, and will be called when adding and removing.', async function (done) {
      class MyTree extends Tree {
        static added = 0;
        static removed = 0;
        addChild(child) { this.constructor.added++; return super.addChild(child); }
        removeChild(child) { this.constructor.removed++; return super.removeChild(child); }
      }
      MyTree.register({ownRuleProperties: []});
      let parent = new MyTree({specs: [{type: 'MyTree'}, {type: 'MyTree'}]});
      let children = await parent.childrenInitialized;
      parent.removeChild(children[0]);
      let bonus = new MyTree();
      parent.addChild(bonus);
      parent.removeChild(bonus);
      expect(MyTree.added).toBe(3);
      expect(MyTree.removed).toBe(2);
      done();
    });
  });
  describe('parent', function () {
    it('defaults to null.', function () {
      expect(new Tree().parent).toBe(null);
    });
    it('can be specified at construction.', function () {
      let parent = new Tree(),
          child = new Tree({parent: parent});
      expect(child.parent).toBe(parent);
      expect(parent.children).toContain(child);
    });
    it('is set when explicitly adding a child.', function () {
      let parent = new Tree();
      let child = new Tree();
      parent.addChild(child);
      expect(child.parent).toBe(parent);
    });
    it('does not maintain relationships when directly messed with outside of construction or addChild.', function () {
      let parent = new Tree(),
          child = new Tree();
      child.parent = parent;
      expect(child.parent).toBe(parent);
      expect(parent.children).not.toContain(child);
    });
    it('tracks dependencies.', function () {
      class MyTree extends Tree {
        parentFoo() { return this.parent && this.parent.foo; }
      }
      MyTree.register();
      let parent = new MyTree({foo: 'p'}),
          child = new MyTree();
      expect(child.parentFoo).toBe(null);
      parent.addChild(child);
      expect(child.parentFoo).toBe('p');
      parent.removeChild(child);
      expect(child.parentFoo).toBe(null);
    });
  });
  describe('specs', function () {
    it('can be specified at construction.', async function (done) {
      class AsyncTree extends Tree {
        static create(specs) {
          return Promise.resolve(super.create(specs));
        }
      }
      AsyncTree.register();
      let tree = new Tree({specs: [{type: 'AsyncTree', foo: 17}, {type: 'Tree', foo: 33}]});
      let children = await tree.childrenInitialized;
      expect(children.length).toBe(2);
      let child = children[0];
      expect(child.constructor.name).toBe('AsyncTree');
      expect(child.foo).toBe(17);

      let child2 = children[1];
      expect(child2.constructor.name).toBe('Tree');
      expect(child2.foo).toBe(33);
      
      expect(child.parent.children).toEqual(children);
      done();
    });
    xit('elements can have a name property.', function () {
    });
  });
  describe('parts', function () {
    it('can be specified as a rule.', async function (done) {
      let sFoo = 42, aFoo = 17, bFoo = 33;
      class FooTree extends Tree {
        foo() { return ''; }
      }
      class Structure extends FooTree {
        a() { return new FooTree({foo: aFoo}); }
        b() { return new FooTree({foo: bFoo}); }
        parts() { return super.__parts().concat(this.a, this.b); }
      }
      [FooTree, Structure].forEach(c => c.register());
      let structure = new Structure({foo: sFoo});
      expect(structure.foo).toBe(sFoo);
      expect(structure.a.foo).toBe(aFoo);
      expect(structure.b.foo).toBe(bFoo);

      let children = await structure.childrenInitialized;
      expect(structure.a.parent).toBe(structure);
      expect(structure.b.parent).toBe(structure);
      expect(children).toContain(structure.a);
      expect(children).toContain(structure.b);
      done();
    });
  });
  describe('children', function () {
    class MyTree extends Tree {
      childrenFoo() {
        return this.children.map(child => child.foo);
      }
      initializedFoo() {
        return this.childrenInitialized.map(child => child.foo);
      }
      bothFoo() {
        this.childrenInitialized;
        return this.children.map(child => child.foo);
      }
    }
    MyTree.register();
    class PartWhole extends MyTree {
      a() {
        return new Tree({foo: 'a'});
      }
      b() {
        return new Tree({foo: 'b'});
      }
      parts() {
        return super.__parts().concat(this.a, this.b);
      }
    }
    PartWhole.register();
    afterEach(function () { Rule.debug = false; });
    it('tracks dependencies from specs.', async function (done) {
      let parent = new MyTree({foo: 0, specs: [{type: 'MyTree', foo: 1}, {type: 'MyTree', foo: 2}]});
      function inspect(label) {
        console.log(label, 
                    Object.keys(parent).map(key => [key,
                                                    (typeof(parent[key]) === 'number') ? parent[key] :  parent[key].cached,
                                                    parent[key].requires && parent[key].requires.map(rule => `${rule.instance.foo}:${rule.key}`)]));

      }
      Rule.debug = true;
      let children = parent.childrenFoo;
      let initialized = await parent.initializedFoo;
      let again = parent.childrenFoo;
      expect(children).toEqual([]);
      expect(initialized).toEqual([1, 2]);
      expect(again).toEqual([1, 2]);
      //inspect('initially:');

      parent.addChild(new MyTree({foo: 3}));
      //inspect('after add:');
      children = parent.childrenFoo;
      initialized = await parent.initializedFoo;
      again = parent.childrenFoo;
      expect(children).toEqual([1, 2, 3]);
      expect(initialized).toEqual([1, 2]);
      expect(again).toEqual([1, 2, 3]);

      parent.removeChild(parent.children[2]);
      children = parent.childrenFoo;
      initialized = await parent.initializedFoo;
      again = parent.childrenFoo;
      expect(children).toEqual([1, 2]);
      expect(initialized).toEqual([1, 2]);
      expect(again).toEqual([1, 2]);      

      parent.addChild(new MyTree({foo: 4}));
      //inspect('before frob:');      
      parent.removeChild(parent.children[0]); // Now we have changed the parent of the first child, thus resetting childrenInitialized.
      //inspect('after frob:');
      children = parent.childrenFoo;
      initialized = await parent.initializedFoo;
      again = parent.childrenFoo;
      expect(children).toEqual([2, 4]); // Removed 1, and added 4.
      expect(initialized).toEqual([1, 2]); // When childrenInitialized computes, it removes all and re-adds resolvedChildren.
      expect(again).toEqual([1, 2]);      // Which is seen by children.
      
      done();
    });    
    it('track dependencies through parts and removes obsolete children.', async function (done) {
      let mapped, children, parent = new PartWhole({specs: [
        {type: 'Tree', foo: 'c'},
        {type: 'Tree', foo: 'd'}
      ]});
      mapped = await parent.bothFoo;
      expect(mapped).toEqual(['a', 'b', 'c', 'd']);

      parent.a = new Tree({foo: "a'"});
      await parent.childrenInitialized;
      mapped = await parent.bothFoo;
      expect(mapped).toEqual(["a'", 'b', 'c', 'd']);
      done();
    });

    it('defaults to empty array.', function () {
      let children = new Tree().children;
      expect(Array.isArray(children)).toBeTruthy();
      expect(children.length).toBe(0);
    });
    it('grows with addChild.', function () {
      let children, parent = new MyTree();
      children = parent.children;
      expect(children.length).toEqual(0);
      parent.addChild(new MyTree());

      expect(children.length).toEqual(1);
      parent.addChild(new MyTree());

      expect(children.length).toEqual(2);
    });
    it('shrinks with removeChild.', async function (done) {
      let children, parent = new MyTree({specs: [{type: 'MyTree'}, {type: 'MyTree'}]});

      await parent.childrenInitialized;
      children = parent.children;
      expect(children.length).toEqual(2);

      parent.removeChild(children[0]);
      children = parent.children;
      expect(children.length).toEqual(1);

      parent.removeChild(children[0]);
      expect(parent.children.length).toEqual(0);
      done();
    });
    it('lists parts before specs.', async function (done) {
      let parent = new PartWhole({specs: [
        {type: 'Tree', foo: 'c'},
        {type: 'Tree', foo: 'd'}
      ]});
      expect(await parent.bothFoo).toEqual(['a', 'b', 'c', 'd']);
      done();
    });
    it('tracks dependencies from empty.', async function (done) {
      let mapped, parent = new MyTree();
      expect(await parent.bothFoo).toEqual([]);

      let added = parent.addChild(new MyTree({foo: 1}));
      let children = parent.children;
      mapped = await parent.bothFoo;
      expect(mapped).toEqual([1]);

      parent.addChild(new MyTree({foo: 2}));
      parent.removeChild(children[0]);
      expect(await parent.bothFoo).toEqual([2]);

      done();
    });
  });
  describe('root', function () {
    it('is the ancestral parent.', function () {
      let branch = new Array(3).fill().map(_ => new Tree());
      // 0 < 1 < 2
      branch[1].children;
      branch[0].children;
      branch[1].addChild(branch[2]);
      branch[0].addChild(branch[1]);
      branch.forEach(b => expect(b.root).toBe(branch[0]));
      // 1 < 2 < 0
      branch[2].addChild(branch[0]); // We can be circular, as long as we don't demand root!
      branch[0].removeChild(branch[1]);
      branch.forEach(b => expect(b.root).toBe(branch[1]));
    });
  });
  describe('initialChildren', function () {
    let added;
    class Loggable extends Tree { // Nice for debugging.
      toString() {
        return `[${this.constructor.name} ${this.foo}]`;
      }
    }      
    class Foo extends Loggable {
      entity() { return null; }
      a() { return new Loggable({foo: 'a'}); }
      b() { return new Loggable({foo: 'b'}); }
      parts() {
        //return super.__parts().concat(this.a, this.b, this.entity.childrenInitialized);
        // FIXME: For reasons I don't understand, the 'can be used in a rule' test will hang
        // if the above is replaced with the following, so don't do that!
          this.entity.childrenInitialized;
          return super.__parts().concat([this.a, this.b], this.entity.children);
      }
      referencingRule() {
        return this.childrenInitialized;
      }
      addChild(child) {
        added.push(child.foo);
        return super.addChild(child);
      }
    }
    Loggable.register({nonRules: ['constructor', 'toString']});
    Foo.register({nonRules: ['constructor', 'addChild']});
    let foo;
    beforeEach(function () {
      added = [];
      foo = new Foo({
        foo: 'root',
        entity: new Loggable({foo: 'entity', specs: [{type: 'Loggable', foo: 'c'}, {type: 'Loggable', foo: 'd'}]}),
        specs: [{type: 'Loggable', foo: 'e'}, {type: 'Loggable', foo: 'f'}]
      })
    });
    it('does not resolve until specs resolve.', async function (done) {
      let children = foo.children;
      expect(children.map(c => c.foo)).toEqual([]);
      children = await foo.childrenInitialized;
      expect(children.map(c => c.foo)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      done();
    });
    it('can be used in a rule.', async function (done) {
      let children = foo.children;
      expect(children.map(c => c.foo)).toEqual([]);
      children = await foo.referencingRule; // Same as above, but through a rule.
      expect(children.map(c => c.foo)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      done();
    });
    it('calls addChild for each.', async function (done) {
      let finalExpectedChildren = ['a', 'b', 'c', 'd', 'e', 'f'];
      let children = await foo.referencingRule;
      expect(children.map(child => child.foo)).toEqual(finalExpectedChildren);
      let tailOfAdded = added.slice(0 - finalExpectedChildren.length);
      // Children are removed and readded during retries.
      expect(tailOfAdded).toEqual(finalExpectedChildren);
      done();
    });
  });
});
