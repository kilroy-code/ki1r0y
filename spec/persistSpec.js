"use strict";
var Persistable = require('../persistable');
var Rule = require('@kilroy-code/rules');

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

describe('Persistable', function () {
  describe('example', function () {
    it('restores what it saves, and responds to change.', async function () {
      Persistable.configure({store: new InMemoryStore()});
      class MyClass extends Persistable {
        foo() { return 0; }
        bar() { return 0; }
        baz(self) { return self.bar; }
      }
      MyClass.register({ownIdentityProperties: ['foo', 'bar']});
      let instance1 = new Persistable({
        type: 'MyClass',
        foo: 33,
        bar: 17
      });
      let id = await instance1.savedId;
      expect(instance1.foo).toBe(33); // Rule was overriden.
      expect(instance1.bar).toBe(17); // Ditto.
      expect(instance1.baz).toBe(17); // Computed.
      
      let instance2 = await Persistable.create({idtag: id, bar: 99, baz: -1});
      expect(instance2.foo).toBe(33); // From persistence.
      expect(instance2.bar).toBe(99); // Persistence overriden.
      expect(instance2.baz).toBe(-1); // Rule overriden.

      instance1.foo = 2;
      expect(instance2.foo).toBe(33); // unchanged;
      let id2 = instance1.savedId; // A Promise rule.
      let instance3 = await Persistable.create({idtag: id2, bar: Promise.resolve(1)});
      expect(instance3.foo).toBe(2); // New value persisted and used.
      expect(await instance3.baz).toBe(1); // Computed from bar when it resolves.
    });
    it('chains across objects.', async function () {
      Persistable.configure({store: new InMemoryStore()});
      class Container extends Persistable {
        name() { return ''; }
        rootName(self) { return self.name; }
        childId() { return ''; }
        child(self) {
          return self.childId && Persistable.create({idtag: self.childId, rootName: self.rootName});
        }
      }
      Container.register({ownIdentityProperties: ['name', 'childId']});
      let childName = 'child',
          parentName = 'parent';
      let stubb = new Container({name: childName});
      expect(stubb.name).toBe(childName);
      expect(stubb.rootName).toBe(childName);
      let persistedId = stubb.savedId;
      let container = new Container({name: parentName, childId: persistedId});
      let child = await container.child;
      expect(child).not.toBe(stubb);
      expect(container.name).toBe(parentName);
      expect(container.rootName).toBe(parentName);
      expect(child.name).toBe(childName);
      expect(child.rootName).toBe(parentName);      

      let nextName = 'changed';
      container.name = nextName;
      // Rule for child depends on name, which has changed, so it is re-evaluated
      let nextChild = await container.child;
      expect(nextChild).not.toBe(child);
      expect(container.name).toBe(nextName);
      expect(container.rootName).toBe(nextName);
      expect(nextChild.name).toBe(childName);
      expect(nextChild.rootName).toBe(nextName);
    });
  });
  describe('api', function () {

    describe('constructor', function () {
      it('can have empty arguments.', function () {
        expect(new Persistable().identitySpec).toEqual({type: 'Persistable'});
      });
      it('accepts properties that override rules.', function () {
        let obj = {foo: 3};
        expect(new Persistable({identitySpec: obj}).identitySpec).toEqual(obj);
        class MyPersistable extends Persistable {
          foo() { return 99; }
        }
        MyPersistable.register({identityProperties: ['foo']});
        expect(new MyPersistable(obj).identitySpec).toEqual(obj);
      });
      it('shifts to a value named in Persistable.types.', function () {
        class NamedSubclass extends Persistable {
          foo() { return 99; }
        }
        NamedSubclass.register({identityProperties: ['foo', 'type']});
        Persistable.types.NamedSubclass = NamedSubclass;

        let instance = new Persistable({type: 'NamedSubclass', foo: 3});
        expect(instance.constructor).toBe(NamedSubclass);
        let identity = instance.identitySpec;
        expect(identity.type).toBe('NamedSubclass');
        expect(identity.foo).toBe(3);
      });
    });
    
    describe('statics', function () {
      describe('collectProperties', function () {
        it('answers promise for passed object if it does not contain id.', function (done) {
          let obj = {foo: 1, bar: 'bar', baz: ['a', 2]};
          Persistable.collectProperties(obj)
            .then(props => expect(props).toEqual(obj))
            .then(done);
        });
        describe('expands idtag with a Promise', function () {
          let props = {a: 1, b: ['c', 3]},
              someTag = 'something',
              string = JSON.stringify(props),
              collectionName;
          beforeEach(function () {
            collectionName = 'unspecified';
          });            
          beforeAll(function () {
            Persistable.configure({store: {retrieve: (collection, id) => {
              expect(id).toBe(someTag);
              expect(collection).toBe(collectionName);
              return Promise.resolve(string);
            }}});
          });
          it('through Persistable.store.', function (done) {
            Persistable.collectProperties({idtag: someTag})
              .then(expanded => expect(expanded).toEqual(props))
              .then(done);
          });
          it('of a direct string as if it were an object with idtag property.', function (done) {
            Persistable.collectProperties(someTag)
              .then(expanded => expect(expanded).toEqual(props))
              .then(done);
          });
          it('merges', function (done) {
            Persistable.collectProperties({idtag: someTag, a: 22})
              .then(expanded => {
                expect(expanded.a).toBe(22);
                expect(expanded.b).toEqual(props.b);
              })
              .then(done);
          });
          it('uses class collectionName.', function (done) {
            collectionName = 'foo';
            let nameCalled = false;
            class MyPersistable extends Persistable {
              static collectionName(idtag) {
                expect(idtag).toBe(someTag);
                nameCalled = true;
                return collectionName;
              }
            }
            MyPersistable.collectProperties(someTag)
              .then(expanded => expect(expanded).toEqual(props))
              .then(_ => expect(nameCalled).toBeTruthy())
              .then(done);
          });
        });
      });
      describe('create', function () {
        it('answers a Promise to construct.', function (done) {
          let spec = {a: 1, b: 2};
          Persistable.create({identitySpec: spec})
            .then(instance => expect(instance.identitySpec).toEqual(spec))
            .then(done);
        });
        it('calls collectProperties.', function (done) {
          let called, spec = {alpha: 'omega'};
          class MyPersistable extends Persistable {
            static collectProperties(props) {
              called = true;
              return Persistable.collectProperties(props);
            }
          }
          MyPersistable.create({identitySpec: spec})
            .then(instance => expect(instance.identitySpec).toEqual(spec))
            .then(_ => expect(called).toBeTruthy())
            .then(done);
        });
      });
      describe('default value', function () {
        it('for numbers is zero.', function () {
          expect(Persistable.isDefaultValueForType(0)).toBeTruthy();
          expect(Persistable.isDefaultValueForType(1)).toBeFalsy();
          expect(Persistable.isDefaultValueForType(-1)).toBeFalsy();
          // These two are misleading, because e.g., JSON.stringify(Infinity) === null.
          // But the point is that the won't be ommitted.
          expect(Persistable.isDefaultValueForType(Infinity)).toBeFalsy();
          expect(Persistable.isDefaultValueForType(NaN)).toBeFalsy();        
        });
        it('for booleans is false.', function () {
          expect(Persistable.isDefaultValueForType(false)).toBeTruthy();
          expect(Persistable.isDefaultValueForType(true)).toBeFalsy();
        });
        it('for strings is empty.', function () {
          expect(Persistable.isDefaultValueForType('')).toBeTruthy();
          expect(Persistable.isDefaultValueForType(' ')).toBeFalsy();
        });
        it('for arrays is empty.', function () {
          expect(Persistable.isDefaultValueForType([])).toBeTruthy();
          expect(Persistable.isDefaultValueForType([undefined])).toBeFalsy();
          expect(Persistable.isDefaultValueForType(Rule.rulify([]))).toBeTruthy();
          expect(Persistable.isDefaultValueForType(Rule.rulify(['']))).toBeFalsy();
        });
        it('for objects is empty.', function () {
          expect(Persistable.isDefaultValueForType({})).toBeTruthy();
          expect(Persistable.isDefaultValueForType({foo: undefined})).toBeFalsy();
        });
      });

      describe('configure', function () {
        it('is a function that takes an object with a store property.', function () {
          let myStorage = 'my-store';
          Persistable.configure({store: myStorage});
          expect(Persistable.store).toBe(myStorage);
        });
        it('accepts a function(collectionName, requestedId, string) as store.save.', function () {
          let instance = new Persistable(),
              collection = instance.collectionName,
              id = instance.requestedIdForSaving,
              identity = instance.identitySpec,
              finalId = 17;
          function mySave(collectionName, requestedId, identityString) {
            expect(collectionName).toBe(collection);
            expect(requestedId).toBe(id);
            let saved = JSON.parse(identityString);
            expect(saved.type).toBeDefined();
            expect(saved.type).toBe(identity.type);
            return finalId;
          }
          Persistable.configure({store: {save: mySave}});
          expect(instance.savedId).toBe(finalId);
        });
      });
      describe('types', function () {
        it('is an object for mapping names to classes.', function () {
          expect(typeof Persistable.types).toBe('object');
        });
        it('includes Persistable.', function () {
          expect(Persistable.types.Persistable).toBe(Persistable);
        });
      });
    });

    describe('ordinary (non-Rule) property', function () {
      describe('identityProperties', function () {
        it('lists type.', function () {
          expect(new Persistable().identityProperties).toEqual(['type']);
        });
      });
      describe('requestedIdForSaving', function () {
        it('is empty string.', function () {
          expect(new Persistable().requestedIdForSaving).toBe('');
        });
      });
      describe('collectionName', function () {
        it('is unspecified', function () {
          expect(new Persistable().collectionName).toBe('unspecified');
        });
      });
    });

    // I'm not sure that we want to document & support gatherProperties outside of identitySpec.

    describe('rule', function () {

      describe('type', function () {
        it('is Persistable', function () {
          expect(new Persistable().type).toBe('Persistable');
        });
        // It isn't very interesting or important that it is memoized or tracks dependencies, just that it computes.
        it('is the class name for subclasses', function () {
          class MyPersistable extends Persistable {}
          class YourPersistable extends MyPersistable {}
          expect(new MyPersistable().type).toBe('MyPersistable');
          expect(new YourPersistable().type).toBe('YourPersistable');
        });
      });

      describe('identitySpec', function () {
        it('answers an object with the keys specified by identityProperties.', function () {
          let gathered = new Persistable().identitySpec;
          expect(gathered.type).toBe('Persistable');
        });
        it('includes extra properties if identityProperties does.', function () {
          class MyPersistable extends Persistable {
            one() { return 1; }
            bar() { return 'bar'; }
          }
          MyPersistable.register({ownIdentityProperties: ['one', 'bar']});
          let gathered = new MyPersistable().identitySpec;
          expect(gathered.type).toBe('MyPersistable');
          expect(gathered.one).toBe(1);
          expect(gathered.bar).toBe('bar');          
        });
        it('does not include default values.', function () {
          class MyPersistable extends Persistable {
            zero() { return 0; }            
            one() { return 1; }
            emptyString() { return ''; }
            string() { return 'x'; }
            emptyArray() { return []; }
            array() { return [this.zero]; }
            emptyObject() { return {}; }
            object() { return { undefined: undefined} }
          }
          MyPersistable.register();
          let gathered = new MyPersistable().identitySpec;
          expect(gathered).toEqual({
            type: 'MyPersistable',
            one: 1,
            string: 'x',
            array: [ 0 ],
            object: { undefined: undefined }
          });
        });
      });

      describe('savedId', function () {
        xit('fixme', function () {
        });
      });
    });
  });
});
