# ki1r0y

I am developing ki1r0y.com, where people will be able to create and share their own applications, long or tiny articles, marketplaces, 3d worlds, and whatever else they want. There is no site to see yet. 

Eventually, there will be a set of introductions from various perspectives, with live demonstrations:

- **Metaverse**: ki1r0y applies metaverse principles of user agency, communication, and realtime collaboration to everything, including text.
- **Attribution Culture**: ki1r0y makes it easy to create, share, and find content, with attibution to the creator and antecedents. This is not just for credit and IP, but also for fighting disinformation.
- **UX**: kilr0y uses undoable direct manipulation, mobile-friendly gestures, voice, and deep copy/paste. Rather than menus, a "perpetual search ui" provides objects and actions in an accessible way (which will be compatible with emerging ubiquitous-computing devices).
- **Cryptogrphy**: ki1r0y pervasively uses modern security techniques, such as used for the same purposes in communication and blockchain.
- **Computer Science**: ki1r0y is based on a small handful of elevated concepts from well-established research on distributed systems, expert systems, and security.

This README describes the constituent [Modules](#modules) and [Design Values](#design-values).


## Modules

The ki1r0y machinery described on this page is made from a number of open-source [npm](https://www.npmjs.com/) Javascript modules. While ki1r0y itself can be thought of as a large application or platform, the constituent modules are meant to be mostly stand-alone libraries. That is, they can be used in entirely separate projects without requiring the use of all the others. (This allows independent development and testing, separation of concerns, and may give individual ideas a life of their own outside of ki1r0y.) In using them individually, it may help to know about the design ideas of ki1r0y, if only to provide the context of why things are designed as they are.

Each of the modules do make use of modern Javascript constructs. If you learned Javascript a long time ago, you'll need to be familiar with these:

- [modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) - [ES6](https://developer.mozilla.org/en-US/docs/Web/JavaScript/JavaScript_technologies_overview) modules are supported in all modern browsers and in NodeJS. We use these _directly_, _without_ requiring preprocessors such as [Babel](https://babeljs.io/) or [Webpack](https://webpack.js.org/). However, to do this, we use the [`.mjs` file extension](https://www.google.com/search?q=.mjs+vs+.js) for Javascript files, rather than `.js`.
- [classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes) and [mixins](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes#mix-ins) - We use mixins in our modules so that the base classes are not baked in. This allows us to develop and test modules independently of all the rest of our code, and it allows others to use the modules in non-ki1r0y projects.
- [getters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) and [setters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set) - properties that compute. Additionally, our [Rules](#core) module uses Javascript [introspection](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors) to automatically recognize getters, which helps us get rid of boilerplate in our code (without needing preprocessing of decorators).
- [async/await and Promises](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous) - The useful thing to remember is that in browsers and in the server, all the application code is in the same thread. Calls out to system functions (e.g., for networking) are run in different threads (allowing any suspended application code to run); going back to the application thread when the application's fulfillment code is called.
- readability:
 - [destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment) - <code>let **{p1, p2}** = this, **[e0, e1]** = that;</code>rather than <code>let **p1** = this**.p1**, **p2** = this.**p2**, **e0** = that**[0]**, **e1** = that**[1]**;</code>
 - [shorthand property names](https://search.brave.com/search?q=javascript+shorthand+property+names) - <code>let x=1, y=2; foo(**{x, y}**)</code> rather than <code>let x=1, y=2; foo(**{x:x, y:y}**);</code>
 - [spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) - <code>function doubleFirst(x, **...rest**) { doSomething(x*2, **...rest**); }</code> rather than <code>function doubleFirst(x) { doSomething.**apply**(null, [2*x].concat( **Array.from(arguments).slice(1)** )); }</code>
 - [fat-arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) - <code>class Foo { method() { frob(**element => this.frazzle(element)**); }}</code> rather than <code>class Foo { method() { **let that=this;** frob(**function (element) { return that.frazzle(element); }**); }}</code>
 - [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) -  `` `The answer is ${computeSomething()}.` ``

### External Dependencies

- **[NodeJS](https://nodejs.org/en/)** ![](public/images/stable.png) - Most of ki1r0y's behavior occurs directly in the user's browser, and interacts with other users peer-to-peer. However, there is a small server that runs the ki1r0y.com site, and this is implemented in Node Javascript.
- **[ExpressJS](https://expressjs.com/)** ![](public/images/stable.png) - The ki1r0y server provides an API for use by both ki1r0y and third-party applications. 
- **[Croquet OS](https://croquet.io/croquet-os/index.html)** ![](public/images/stable.png) - In the browser, everything in ki1r0y is synchronized through Croquet's P2P model, which does not use any application-specific server code at all. 
- **[webRTC](https://webrtc.org/)** ![](public/images/stable.png) - p2p voice, video, and screensharing is now built into all browsers. Reliability is greatly enhanced by having ki1r0y run a **[TURN](https://github.com/coturn/coturn)** service.
- **[Material Design](https://www.material.io/)** ![](public/images/experimental.png) - The UI is built on these mature design principles for mobile and desktop Web, and (will be) skinnable and customizable through ordinary MD stylesheets.
- **[Elasticlunr.js](http://elasticlunr.com/)** ![](public/images/deprecated.png) - I had success using this to implement internal search, but it isn't being developed any more. 
- **[Jasmine](https://jasmine.github.io/)** ![](public/images/stable.png) - Everything (marked stable) below has unit tests that run in both [browser](test.html) and the command line, using this test framework. In general (but not always), the test suites conditionalize dependencies such that when the tests are run in the browser, they are using the real system APIs (like a system integration test), and when running in NodeJS from the command line, they use dummy (aka mocked) system APIs (as a more focused unit test). This allows developers to quickly and repeatedly test the module they are working on, while the public [browser](test.html) confirms that all the deployed code is correctly working together.

### Modeling

- **[rules](https://github.com/kilroy-code/rules)** ![](public/images/stable.png) - Makes Javascript object properties work like the cells of spreadsheets. This is the secret-sauce that allows small behaviors from different authors to be combined interactively, even though they were written for different applications.
- **[blocks](https://github.com/kilroy-code/blocks)** ![](public/images/experimental.png) - The current version is not what I want. It successfully integrates rules and croquet, but I don't like how it handles hierarchy and display objects.

### Nouns

- **[nodes](https://github.com/kilroy-code/nodes)** ![](public/images/experimental.png) - The nouns that display, get manipulated, and persist in ki1r0y.
- **[display2d]()** ![](public/images/prototyped.png) - A blocks-based wrapper around Material Design, in which the ki1r0y UI and 2d user content are built. (A display3d is also planned, but not part of the ki1r0y [MVP](https://en.wikipedia.org/wiki/Minimum_viable_product).)

### Verbs

- **[actions]()** ![](public/images/intended.png) - The verbs of ki1r0y are implemented as nouns that do something, attached to blocks.
- **[edit-text]()** ![](public/images/prototyped.png) - Lightweight [WYSIWYG](https://en.wikipedia.org/wiki/WYSIWYG) editing, but multi-user and always available throughout the UI. (There is no edit mode or edit forms.)
- **[edit-nodes]()** ![](public/images/prototyped.png) - Everything shown is a reified object that can be moved around interactively. Some of the things that can be moved are affordances that interactively change the shape, size, or orientation of what they are attached to.
- **[transfer]()** ![](public/images/prototyped.png) - Move, copy, and link from any ki1r0y composition, or from other systems.

### Persistance

- **[authentication]()** ![](public/images/intended.png) - Instead of centralized accounts, all persistent storage is based on [Public-Key Cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography), so that anyone can sign an artifact, and anyone can check it.
- **[storage](https://github.com/kilroy-code/storage)** ![](public/images/experimental.png) - When an action is completed, all and only the changed blocks are persisted, where they are available for going back to earlier versions, and for third-party applications.

### Application

- **[share]()** ![](public/images/prototyped.png) - Tools for sharing on social media and external search engines. 
- **[graffito]()** ![](public/images/intended.png) - The [Medium](https://medium.com/)-like application of all the above, with displays for avatars, chat, inspection of objects, and related content.



### Scaffolding

- **[garbage-collection]()** ![](public/images/prototyped.png) - A realtime background GC that I've previously written so that stale versions of objects (and their media) can be removed from storage.
- **[croquet-in-memory](https://github.com/kilroy-code/croquet-in-memory)** ![](public/images/stable.png) - A sloppy implementation of some of the Croquet API that only supports one user, with no server and no persistence, and is used in unit tests.
- **[api-key](https://github.com/kilroy-code/api-key)** ![](public/images/stable.png) - A trivial mechanism for a browser app or test suite to get a use key for an API (such as for Croquet), without embedding keys in source code.
- **[hidden-tab-simulator](https://github.com/kilroy-code/hidden-tab-simulator)** ![](public/images/stable.png) - Machinery to simulate a browser tab being hidden or being revealed, for use in unit tests.
- **[utilities](https://github.com/kilroy-code/utilities)** ![](public/images/experimental.png) - Shared code.## Design Values

These are our "North Stars". 

- The **bold bullets** are the main user principles, not in any priority.
 - The sub-bullets are a very dense illustrations of how the underlying code behaves.

- **SIMPLE - ki1r0y doesn't model the universe. But for the things it does well, simple things are simple, and complex things are possible. We do this through simple but sophisticated models built around reusable blocks.**
 - Everything the user sees is a reified block: paragraph, heading, avatar, image, 3d shape, etc.. Internally, these are modeled as a person, place, or thing (with varying implications on how data is versioned and stored).
 - We make blocks obvious by making it easy for the user to select them and move them around. Direct-manipulation is fun and gives people a feeling of empowerment.
 - Blocks have properties, which are shown and adjustable in the inspector.
 - We avoid "mode" implementation concepts such as edit-time, load-time, run-time. Everything is always live. 
- **SYNCHRONIZED - The properties of a block stay synchronized across all the different displays of the same block -- even between other users.**
 - As in a spreadsheet, the formula in one property may refer to another property (perhaps in another block). When the referenced property changes, the referring property automatically updates to a newly computed value, based on its formula.
 - Blocks have various displays by which they can be seen and minipulated. Changing a property in one display will automatically update in other displays.
 - When something changes, the same block automatically changes for all users in the same place. This includes the avatar blocks of the people who are currently on that page, as well as their current selections.
- **STORED - Whenever someone's interaction with a block ends (e.g., the end of dragging it from one location to another), the block is saved in externally accessible files in a way that securely memorializes the block's provenance.**
 - Media is saved under a name based on the standard media file content bits - a hash. Any number of blocks may reference the media, and the title, author, and other metadata is part of the referencing block rather than the media. When a block is saved, the data is cryptographically signed by the author, along with a timestamp and a reference to the antecedent block (e.g., what block was edited to produce this one).
 - When a property of an ordinary thing changes, it is technically considered to be a different thing. The URL to its saved data is different. For example, if you change the handle of a hammer, or even it's name, it is no longer the same hammer. However, that same hammer - with the same URL, can appear many times on a page or even across different pages. Anyone can create a new thing. However, the system will just ignore an attempt to save an already existing thing - i.e., with the exact same data as something that someone else already made. The existing URL will be used - even on different pages by different authors.
 - A place is different from things in that it retains it's identity - and the URL to its data - even as it is changed. For example, when something is added or changed within Montana, it is still Montana. However, there can be only one Montana. ki1r0y maintains a history of each version of a place as it changes. Anyone can create their own new place: if I try to save your place, the system just makes a copy for me, with a different URL.
 - A person also maintains its identity as it changes. However, we do not keep a version history of a person's personal data. Only the owner of a person block can save changed data.

- **STRUCTURED - A place can be visited by persons: a blog, an app, a 3d scene graph, etc. A place is a kind of block, made of an assembly of other blocks. This structure helps users navigate the system.**
 - The top-level place in the structure defines an overall composition. 
 - As an individual user navigates the content of a place - by tab key or arrow keys, selecting a block, or other navigation - the URL changes in their browser. Visiting this URL positions the user at that same specific block within the composition.
 - When saving a block, the "inputs" are part of the parent's data, not the child blocks. This includes text formatting, position/size/rotation of geometric objects, material or other built-in variants, and playback timestamp for playable media. This is what allows, e.g., the text "Led Zeppelin" to be the same thing wherever it appears, regardless of formatting.
 - Behaviors are blocks that are attached to display blocks. When a user makes some gesture on a display object, we look up the tree structure to find the behavior. (Technically, this is called part-whole inheritance.)
- **SOCIAL - People can text and talk live with the other people in the same place, and can see how they interact with the blocks. Each block in the structure can be individually shared on social media, and people who follow those links from social media arrive at the specific block that was shared.**
 - If the user selects a block (e.g., by clicking it), the user is shown information about it *and* its antecedents, such as the title, description, author, and social media shares, and buttons for the user to share that block themselves. (Cancelling a selection, such as clicking on "nothing", selects the overall composition.)
 - By having URLs for individual blocks, there are many more sharable items than just for the overall composition. When that URL is scraped by the social media site, the title, description, image, and other metadata is for that specific block.
 - On the other hand, the URL is for that block's content wherever it may appear - multiple times in the same composition, or even across different compositions by different users. This allows popular blocks to accumulate a lot of social media interactions. (All social media ignore "campaign" URL query parameters when counting interactions, but include the parameters when linking back to the content. We use these parameters to identify the commposition and any instance repetition of the block within the composition.)
 - A user can be a member of any number of self-formed "teams" within ki1r0y. While each block tracks the edits by individual authors, a composition as a whole can be owned by a team of authors. Teams can make their own rules, much like a [DAO](https://en.wikipedia.org/wiki/The_DAO_(organization)).
- **SEARCHABLE - Related ki1r0y content suggestions are shown for whatever you interact with. The content is automatically optimized for external search to bring people directly to the relevant part of a composition.**
  - As a user interacts with ki1r0y, related items are unobtrusively shown. This gives the reputed benefit of personalized ads, but without an actual ad, and done for the user's benefit rather than an advertiser's. (Also, content is is related to the action, not the person, as we do not track personal histories.)
  - Text chat is taken as a search. There's no need for a separate search mode. When navigating to a block, the title and related metadata are used as search terms. The results first include any matching blocks from the same composition, and then from your "teams". This is a great way guide users within the composition or team, and to provide custom "commands" - blocks that do something when selected. It's more "people like you also read..." then "here's the what's happening". (A home page feed might be more time-based.)
  - The system scores content based on successful interactions. This encourages content creators to have meaningful and accurate titles and related metadata.
  - External search engines scrape whole sites rather than specific pages as social media does, and they use URLs in different ways. To handle both while also having URLs that point to specific blocks within a composition, ki1r0y always presents two different kinds of canonical URLs in the page metadata.
- **SAFE - Users can safely explore without fear of breaking something, getting lost, or being harmed by others. They can have faith in the accuracy of the author metadata and social media interactions of specific content.**
 - There is a distinction between an author (always an individual user) and an owner  (an individual author or a team of authors). Anything a user changes cites the changing user as author, backed by their irrupudiable cryptographic signature. Anything new in a composition is owned by the composition owner. The user can inspect the authenticity and integrity of each block and its antecedents, including authorship. (Alas, we don't know of any way to cryptographically authenticate the algorithm of related-content/feed suggestions that we show the user.)
 - A composition is either open to all (public), or only readble by its (individual or team) owner. All content that you can read is also writable: new content is saved under the existing owner if the author is on the team, or safely saved under the new author's ownership otherwise. (It is like automatically forking a git repo.)
 - Each composition change gets a new URL, labeled in the browser history with action that changed it. Any user present can "undo"/"redo" with the browser back/forward button, or browser history.
 - At any time, any user can leave the group of users of the current composition, while staying in a "group of one" on the current composition. Neither group sees live changes made by the other, and there is no conflict in saving because both are saving changes separately under their own author or team names. (Leaving in this way will save team-owned compositions under the individual's ownership.)
- **SPEEDY - Users shouldn't have to wait for the system.**
 - The different block and media semantics allows for different storage mechanisms. Since the overwhelming majority is immutable, it can be cached at client and server using conventional mechanisms. The global nature of media files' content-based URLs means that it reused media is likely to be cached, and the search and social mechanisms encourage reuse.
 - The block structure and properties are very small, and arrive very quickly and all at once through the (Croquet) collaboration snapshot upon entering. It includes enough information that meaningful placeholders can be displayed (plain text, 3d cubic volumes) as media is then incrementally loaded based on position within the composition. Additionally there is enough information in the two different kinds of URLs (from search and social media), that a server can get the relevant block data to build a static page very quickly on demand. Initial static page time is important for visitors entering the site through search or social, external links, and goes into external search-engine quality metrics.
 - Once in, synchronizing changes are fast because our (Croquet) mechanism transmits only the user's gesture, not the object's new state. Additionally, the effect of the  user's gesture can be shown locally in that user's display immediately.
 - Saving requires only the block that has changed and it's ancestors. The data is small enough that signing it is quick.
- **SCALABLE - Being useful depends on being able to handle a lot of users, a lot of content, and a lot of different kinds of each. Moreover, compositions by different people can be tiled to produce a larger whole.**
 - All the "server" operations are stateless and partitionable by URL, which makes it easy to balance load among a dynamically scalable set of machines. Moreover, many of them are amenable to federation by a variety of distributed user-contributed services.
 - While ki1r0y doesn't try to cover every kind of content (e.g., twitchy single-user games, or military situations), it does cover a very broad array of needs. This may include code/behavior as sharable/attributed media, DAOs, and distributed/authenticated open ledgers.
 - Examples of tiling are to be determined, but may include: mostly independent marketplace stalls and time-ordered ledger-regions, or 2d map-worlds and expansive 3d scenes.

