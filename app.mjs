import process from 'process';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import compression from 'compression';
import { ki1r0yError, ClientError } from '@kilroy-code/utilities/errors.mjs';

process.title = 'ki1r0y';

const app = express();
export default app;

// Configure the app with information used by some routers.
app.locals.oneYearSeconds = 60 * 60 * 24 * 365;          // W3C recommends not aging more than a year. 
app.locals.oneYearMs = app.locals.oneYearSeconds * 1000; // Express/connect time is in milliseconds (as for node generally).
app.locals.rootDirectory = path.dirname(new URL(import.meta.url).pathname);
app.set('dbdir', path.join(app.locals.rootDirectory, 'db'));      // Must be on same system for efficient file uploads and static gets.

import siteRouter from './routes/index.mjs';
import configureNouns from './routes/nouns.mjs';
const nounRouter = configureNouns(app);

// It is more efficient to support gzip in a production reverse proxy, but doing it here in development
// so that we're more likely hit any snags now rather than in production.
app.use(compression());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(function(req, res, next) { // FIXME: review for production.
  // Nice for debugging.
  res.setHeader('X-Powered-By', 'ki1r0y');  // Defaults to 'Express'
  // Prevent code from sending out your data. \
  // This is effectively the default, without us specifying it. Explicitly including it here serves as documentation of intent.
  // FIXME: removed for croquet-rule-test: res.setHeader('Content-Security-Policy', "connect-src 'self'");
  next();
});
app.use(express.static(path.join(app.locals.rootDirectory, 'public')));


app.use('/', siteRouter);
app.use('/noun', nounRouter);

app.use(function (req, res, next) {
  throw new ClientError(`${req.method} ${req.path} not found`, {req, status: 404});
});
app.use(function (err, req, res, next) {  // The default also displays the stack, which is TMI.
  let pojo = ki1r0yError.pojo(err);
  // FIXME: conditionalize this to not do so in production.
  if (!(err instanceof ClientError)) {
    console.error(err.stack);
  }
  res.status(pojo.status || 500).send(pojo);
});
