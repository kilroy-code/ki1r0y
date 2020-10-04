"use strict";
var Registerable = require('../registerable');
var DisplayController = require('../displayController');

describe('DisplayController', function () {
  describe('example', function () {
    class ControllerForSomeExternalDisplayMechanism extends DisplayController {
      display() { return new SomeExternalDisplayMechanism(this.constructor.name); }
      update() { return this.display.update(`name: ${this.entity.name}`); }
      resetDisplay() { SomeExternalDisplayMechanism.remove(this.display); return super.resetDisplay(); }
    }
    class Displayer extends ControllerForSomeExternalDisplayMechanism {
    }
    class Editor extends ControllerForSomeExternalDisplayMechanism {
      display(self) { // Attach a handler to the display object.
        let display = super.__display(self);
        display.changeName = string => this.entity.name = string;
        return display;
      }
    }
    class Node extends Registerable {
      name() { return ''; }
      readOnlyView() { return new Displayer({entity: this}); }
      editorView() { return new Editor({entity: this}); }
    }
    class SomeExternalDisplayMechanism {
      static getContent() { return this.output.map(item => `${item.tag}: ${item.content}`).join(', '); }
      static remove(item) { this.output = this.output.filter(displayed => displayed !== item); }
      constructor(tag) {
        this.tag = tag;
        this.constructor.output.push(this);
      }
      update(content) { return this.content = content; }
      getContent() { return this.content; }
    }
    [Node, ControllerForSomeExternalDisplayMechanism, Displayer, Editor].forEach(c => c.register({nonRules: ['constructor', 'resetDisplay']}));

    beforeEach(function () {
      SomeExternalDisplayMechanism.output = [];
    });      
    it('display the same underlying data in all views', function (done) {
      let name = 'foo',
          node = new Node({name: name}),
          label = `name: ${node.name}`;
      node.readOnlyView;
      node.editorView;
      process.nextTick(_ => {
        expect(SomeExternalDisplayMechanism.getContent()).toBe(`Displayer: ${label}, Editor: ${label}`);
        done();
      });
    });
    it('a method invoked in one view changes what is shown in all.', function (done) {
      let name = 'foo',
          node = new Node({name: name});
      node.readOnlyView;
      process.nextTick(_ => {
        node.editorView.display.changeName('bar');
        process.nextTick(_ => {
          let label = `name: ${node.name}`;
          node.readOnlyView;
          expect(SomeExternalDisplayMechanism.getContent()).toBe(`Displayer: ${label}, Editor: ${label}`);
          done();
        });
      });
    });
    it('a change of entity changes what is shown.', function (done) {
      let name = 'foo',
          node = new Node({name: name}),
          editor = node.editorView,
          otherNode = new Node({name: 'baz'});
      editor.adopt(otherNode);
      process.nextTick(_ => {
        let label = `name: ${otherNode.name}`;
        expect(SomeExternalDisplayMechanism.getContent()).toBe(`Editor: ${label}`);
        done();
      });
    });
  });
});
