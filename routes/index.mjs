import express from 'express';
import { ServerError } from '../public/@kilroy-code/utilities/errors.mjs';

const router = express.Router();
export default router;



/* GET home page. */
router.get('/', function (req, res, next) { // Home page
  console.log('fixme: I thought this was not used because we have a public/index.html');
  res.render('index', { title: 'Express' });
});

router.get('/fail', function (req, res) { // For testing error handling.
  throw new ServerError(`${req.method} ${req.path}`, {req, status: 500});
});

router.use(express.text());
function corsEnd(req, res, methodsString) {
    res.set('Access-Control-Allow-Origin', req.headers.origin);
    res.set('Access-Control-Allow-Methods', methodsString);
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
}
router.post('/disconnect-diagnostics', function (req, res) {
  console.log(req.body);
  corsEnd(req, res, 'GET, POST, OPTIONS');
});

router.get('/apiKey/croquet', function (req, res, next) {
  res.send("17GxHzdAvd4INCAHfJoDm39LH6FkmkLa5qdLhGLqA");
});
