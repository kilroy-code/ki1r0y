import path from 'path';
import fs from 'fs/promises';
import express from 'express';
import passport from 'passport';
import { BasicStrategy } from 'passport-http';
import { IdentityMetadata } from '../public/@kilroy-code/storage/identityMetadataNode.mjs';
import errors from '../public/@kilroy-code/storage/errors.mjs';

const nouns = express.Router();

// We could just export default nouns;
// However, we instead export a function that is called with the partially configured app,
// so that we can use app.get and app.local at startup time rather than each call (e.g., req.app).
function configureRouter(app) {

  // Nouns are designed to read very very fast, and to allow lots of different implementations at different scales:
  // The subroute path is always /:collectionName/:tag.:fileExtension
  //   so it works as a static file server, and the mime types will be correct.
  // By far, most of the requests are to collections of immutable data
  //   so they can be cached, and they're small and generic enough to be in-cache in normal use,
  // and they don't get an id until they are initally put, so there's no way anyone can read as it is being written
  //   which means reading can be done without any locks.
  // The are all small enough that get and put handle all our needs, and there is no general iteration.

  // This is much less general, but much more efficient, then "resourceful routing", where the 
  // operations require expensive locks and iteration that can't be optimized away.

  function configureDirectory(base, ...args) { // same as path.join, but ensuring that directory exists. For startup only.
    let pathname = path.join(base, ...args);
    console.log('Ensuring', pathname);
    fs.mkdir(pathname, {recursive: true});
    return pathname;
  }
  function collectionPath(...args) {
    return configureDirectory(app.get('dbdir'), ...args);
  }

  function rawJson() { // Sets req.body to a raw buffer, but only for json mime types.
    return express.json(); // fixme: rawJson() => express.json (no parens), below
  }
  function processBody(req, res, next) { // Sets req.body to an IdentityMetadata object.
    req.body = IdentityMetadata.fromObject(req.body);
    next();
  }
  async function hashRaw(req, res, next) {
    let data = req.body;
    if (!Buffer.isBuffer(data) && (typeof(data) !== 'string')) {
      req.body = data = JSON.stringify(data); // FIXME: use mime type?
    }
    req.params.tag = await IdentityMetadata.hashDigest(data);
    req.creationTimestamp = Date.now(); // It's a little hokey do this here, but convenient.
    next();
  }
  async function hash(req, res, next) { // sets req.params.tag to hash of req.body. Must be after processBody.
    req.params.tag = await req.body.getIdentityHashDigest();
    next();
  }

  // A private property is one that is stored separately from the combined identity/non-identity json, so that it is
  // not answered by a get of the noun. So instead of mapping {collection, tag} => json, a private property maps
  // {collection, tag, property} => a single value. CURRENTLY, this is always read/written at the server (no REST endpoint)
  // and is currently a string value.
  const privateUserPropertyPath = collectionPath('mutable', 'userProperties');
  let unknownUser = 'unknownUser'; // fixme gensym
  async function writePrivateUserPropertyString(tag, property, value) {
    let directory = path.join(privateUserPropertyPath, tag),
        pathname = path.join(directory, property);
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(pathname, value);
  }
  async function readPrivateUserPropertyString(tag, property) {
    let key = path.join(privateUserPropertyPath, tag, property),
        buffer = await fs.readFile(key);
    return buffer.toString();
  }
  async function isInSet(base, scope = '', value = '') {
    const pathname = path.join(base, scope, value),
	  accessed = await fs.access(pathname).catch(error => error); // FIXME: should catch answer null?? But tests fail!
    return !accessed;
  }
  async function addToSet(base, scope, value) {
    let directory = path.join(base, scope),
        filename = path.join(directory, value);
      await fs.mkdir(directory, {recursive: true});
      let fd = await fs.open(filename, 'w');
      await fd.close();
    return scope;
  }

  // Authorization is currently done by Basic authentication.
  function allowUnseenAuthorization(req, res, next) {
    // Middleware that tells downstream middleware to automatically create a private property for first-time writes.
    req.allowUnseenAuthorization = true;
    next();
  }
  passport.use(new BasicStrategy(
    // This router expects Basic auth (else 401 Unauthorized challenge), and sets req.user to the usertag on success.
    // (NOT to the whole user object, as there is no need to read/find the user object on each request.)
    // The hashed password is compared against a previously stored hash password private property.
    // If there is no such property stored, the request fails with 403 Forbidden (breaking the browser/server loop),
    // UNLESS the route does allowUnseenAuthorization (e.g., for owner route), in which case it writes the property.
    {passReqToCallback: true}, // Causes req to be passed as the first argument to the verifier here.
    async function (req, usertag, password, done) {
      let hashedPassword = await IdentityMetadata.hashDigest(password)
      try {
        let recorded = await readPrivateUserPropertyString(usertag, 'hashedPassword');
        // passport will set req.user to the second value supplied here.
        // Give usertag in this path IFF the hashed passwords match.
        return done(null, (hashedPassword === recorded) && usertag);
      } catch (error) {
        if (error.code !== 'ENOENT') return done(error); // A normal error.
        if (!req.allowUnseenAuthorization) return done(new errors.ForbiddenError(`Unknown authorization ${usertag} is forbidden.`, {req, tag: usertag}));
        // Credentials that have never been seen before.
        // TODO Is this really always safe against race conditions?
        await writePrivateUserPropertyString(usertag, 'hashedPassword', hashedPassword);
        return done(null, usertag);
      }
    }));
  const proveUserTag = passport.authenticate('basic', {session: false}); // Authenticates by header and puts usertag in req.user. See BasicStrategy, above.
  
  function matchAuthorSubjectTags(req, res, next) {
    let author = req.body.nonIdentityData.userTag,
        subject = req.params.tag;
    next((subject !== author) &&
         new errors.ForbiddenError(`Author ${author} is forbidden from editing subject ${subject}.`,
                                   {req, tag: author}));
  }
  function matchAuthorToUser(req, res, next) {
    let data = req.body,
        author = data.nonIdentityData.userTag,
        authenticatedTag = req.user;
    req.creationTimestamp = data.nonIdentityData.timestamp;
    next((!authenticatedTag || (authenticatedTag !== author)) &&
         new errors.ForbiddenError(`Writing as ${author} is forbidden for a user authenticated as ${authenticatedTag}.`,
                                   {req, tag: authenticatedTag}));
  }
  const restrictionsPath = collectionPath('mutable', 'restriction');
  async function matchToRestriction(req, res, next) {
    let authenticatedTag = req.user,
        tag = req.params.tag
    if (await isInSet(restrictionsPath, tag, authenticatedTag)) return next(); // restricted to just req.user
    // FIXME: Implement restiction that names the authorizing composition:
    // get authorizing-composition cookie
    // if not present and this path is place, fail req.user is not in place.userTag's friends. Otherwise authorizing place
    // if authorizing place is in the restriction, set cookie for response, and continue w/o error.
    // else the following error
    next(new errors.ForbiddenError(`${tag} is forbidden for a user authenticated as ${authenticatedTag}.`,
                                   {req, tag: authenticatedTag}));
  }
  function isUserTag(tag) {
    return tag.length === 36;
  }
  async function maybeRestrict(req, res, next) { // Must be after matchAuthorToUser, which confirms that userTag matches writing user.
    let restriction = req.body.identityData.restriction;
    if (!restriction) return next();
    // fixme deal with !isUserTag(tag) case.
    let tag = req.params.tag;
    req.params.tag = '!' + tag;
    console.log('*** restrict', restrictionsPath, tag, restriction);
    await addToSet(restrictionsPath, tag, restriction);
    next();
  }
  function extensionForMimeType(req, res, next) { // sets req.params.fileExtension for the given mime type.
    let mime = req.headers['content-type'];
    if (mime === 'application/json') req.params.fileExtension = 'json';
    else if (mime === 'text/plain') req.params.fileExtension = 'txt';
    else if (mime.startsWith('image/')) req.params.fileExtension = mime.slice('image/'.length);
    else throw new errors.ClientError(`Unsupported MIME type ${mime}.`, {status:415, req});
    next();
  }
  function recombineBody(req, res, next) {
    req.body = req.body.getCombinedJSON();
    next();
  }
  function writeToCollection(base, exclusive = false, isNoun = true) {
    // FIXME: If this is a new item, HTTP standard says PUT should code 201 Created. (We might have enough info during auth checking.)
    return function (req, res, next) {
      const tag = req.params.tag,
	    extension = req.params.fileExtension,
            pathname = path.join(base, tag + '.' + extension),
            // A guid, in case the owner is writing from multiple browsers simultaneously.
            writingPathname = exclusive ? (pathname + '.' + IdentityMetadata.uuid()) : pathname;
      let buffer = req.body;
      // It is it tempting to accept a string that is written directly, but this is probably a false economy:
      // 1. Misformed json could mess up our internal operations and result in loss of data.
      // 2. Other implementations, or additional integrity tests, might deal directly in POJOs anyway.
      // FIXME: do this upstream somehow, only where/when we need to. (Only occurs in the media case.)
      if ((extension === 'json') && (typeof(buffer) !== 'string')) buffer = JSON.stringify(buffer);
      fs.writeFile(writingPathname, buffer, {flag: "wx"})
        .then(async () => {
          if (exclusive) {
            // We don't define which reads get results from before and which get after.
            // (After all, the requests could reach the server in any order.)
            await fs.rename(writingPathname, pathname);
          }
          res.send({tag, userTag: req.user, timestamp: req.creationTimestamp});
        })
        .catch(error => {
          if (error.code !== 'EEXIST') return next(error);
          if (!isNoun) return res.send({tag}); // No original usertag or timestamp available.
          // For nouns, we would like the writer to update their data with the correct old userTag and timestamp.
          fs.readFile(pathname).then(buffer => {
            let json = JSON.parse(buffer);
            json.tag = tag; // No-op if already defined.
            res.send(json); // Combined rather than just the identity data, but that still meets the spec and is futureproof for signature.
          });
        });
    };
  }

  function writeImmutable(collection, isNoun = true) {
    // There should be no reads while a write is in progress:
    // 1. The name is computed by the server (earlier in the middleware), and so a client won't be telling anyone what
    //    to read until after it is written. (Bad software could compute this before writing, but by definition
    //    it can only screw up the author's content, not someone else's.)
    // 2. A subsequent write of the exact same data (and thus the same tag) will get EEXIST rather than writing. 
    return writeToCollection(collectionPath('immutable', collection), false, isNoun);
  }
  function writeMutable(collection) {
    // There can be any number of reads while there is an updating write. The 'atomic' flag prevents problems.
    return writeToCollection(collectionPath('mutable', collection), 'atomic');
  }
  function writeSetMember(collection) { // Accept :tag as known friend of the submitting user.tag. FIXME...
    let base = collectionPath('mutable', collection);
    return async function (req, res, next) {
      let tag = req.params.tag,
          friend = req.body;
      await addToSet(base, tag, friend)
      res.send({tag});
    };
  }

  function readImmutable(collection) {
    let base = collectionPath('immutable', collection);
    return express.static(base, {
      maxAge: app.locals.oneYearMs,
      immutable: true
    });
  }
  // Note: req.url is used by express.static, and there is a subtle difference in the definition between .get and .use:
  // For .get, the req.url is everything not stripped off by the router,
  //    so /noun/place/123.json matched by nouns.get('/place/:tag.json') has req.url:'/place/123.json'.
  // For .use, the definition does it's own stripping as if it were a router,
  //    so /noun/place/123.json matched by nouns.use('/place', ...) has req.url:'/123.json'.
  // Since we are using nouns.get rather than nouns.use, we don't need the collection name in static root.
  let mutableRoot = collectionPath('mutable');
  function readMutable(collection) {
    return express.static(mutableRoot);
  }

  // Client specifies tag for both.
  nouns.route('/owner/:tag.json')
    .get(readMutable('owner'))
    .put(rawJson(), processBody, allowUnseenAuthorization,  proveUserTag, matchAuthorSubjectTags, matchAuthorToUser,                extensionForMimeType, recombineBody, writeMutable('owner'));
  // ISSUE: Should this actually be an arbitrary json? Conceptually, it could be just a point to the current version.
  // One concern is where we keep the version history. Does it live in the place, as additional data, or within each version?

  // Subtle: matchToRestriction is operating on req.params.tag, which is the naked tag without the '!'. It looks for that naked tag's restriction set.
  // But readMutable uses req.url, which is /place/!whatever.json, including the '!'.
  // So we are relying on the naked /place/whatever.json to NOT be stored, so that people can't read stuff by stripping the '!'.
  nouns.get('/place/!:tag.json',                            proveUserTag,                         matchToRestriction,                                                   readMutable('place'));
  nouns.route('/place/:tag.json')
    .get(readMutable('place'))
    .put(rawJson(), processBody,                            proveUserTag,                         matchAuthorToUser, maybeRestrict, extensionForMimeType, recombineBody, writeMutable('place'));
  nouns.route('/allow/:tag')
    .post(proveUserTag, writeSetMember('friend'));

  nouns.use('/thing', readImmutable('thing'));
  nouns.post('/thing', rawJson(), processBody,     hash,    proveUserTag,                         matchAuthorToUser,                extensionForMimeType, recombineBody, writeImmutable('thing')); 
  nouns.use('/media', readImmutable('media'));
  // Although we require that the request proveUserTag, just to cut down on mischief, we don't do anything with that tag here.
  nouns.post('/media', express.raw({type: '*/*'}), hashRaw, proveUserTag,                                                           extensionForMimeType,                writeImmutable('media', false));

  const fixmeOwner = collectionPath('mutable', 'owner'),
	fixmePlace = collectionPath('mutable', 'place'),
	fixmeThing = collectionPath('immutable', 'thing'),
	fixmeMedia = collectionPath('immutable', 'media'),
	fixmeFriend = collectionPath('mutable', 'friend');
  nouns.delete('/:tag', async (req, res, next) => {
    // FIXME: For now, this just for test suite cleanup.
    // TODO:
    // - Require the correct collection instead of searching. The test suite will have to track this. (Maybe add to response? Maybe distinguish tags?)
    // - Require the correct file extension instead of searching media. The test suite will have to track this.
    // - Require authentication as owner of nouns.
    // - Require authentication and owning noun for deleting media. The test suite will have to track this.
    let tag = req.params.tag,
	json = `${tag}.json`;
    Promise.any([
      path.join(fixmeOwner, json),
      path.join(fixmePlace, json),
      path.join(fixmeThing, json),
      path.join(fixmeMedia, json),
      path.join(fixmeMedia, `${tag}.txt`),
      path.join(fixmeMedia, `${tag}.png`)
    ].map(pathname => fs.rm(pathname)))
      .then(async r => {
	// If it was a user
	await fs.rm(path.join(fixmeFriend, tag), {recursive: true}).catch(_=>_);
	await fs.rm(path.join(privateUserPropertyPath, tag), {recursive: true}).catch(_=>_);
	// If it was an place, there might be restrictions. (Drop the leading '!' from the tag.)
	await fs.rm(path.join(restrictionsPath, tag.slice(1)), {recursive: true}).catch(_=>_);
	res.send({tag});
      })
      .catch(e => {
	next(new errors.TaggedError("Not found.", {tag, req, status: 404}));
      });
  });

  // FIXME: thing generates nonIdentity data and merges.
  // FIXME: various auth.
  // FIXME: copy to newspace.
  // FIXME: pluggable for multiple implementations: subdirectories, key/value store

  nouns.use(function (req, res, next) {
    let match = req.path.match(/^\/(.*)\/(.*)\./),
        collection = match && match[1];
    if (['place', 'owner', 'thing', 'media'].includes(collection)) {
      let tag = req.params.tag || match[2]; // place & owner define req.params.tag, but thing & media need to be parsed
      throw new errors.MissingItemError('', {kind: collection, tag, req});
    }
    throw new errors.MissingCollectionError('', {tag: collection, req});
  });

  return nouns;
}
export default configureRouter; // fixme: just decorate the function with export, instead of making a default export.
