# ![Popsicle](https://cdn.rawgit.com/blakeembrey/popsicle/master/logo.svg)

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

**Popsicle** is designed to be easiest way for making HTTP requests by offering a consistent, intuitive and light-weight API that works with both node and the browser.

```js
popsicle('/users.json')
  .then(function (res) {
    console.log(res.status) //=> 200
    console.log(res.body) //=> { ... }
    console.log(res.headers) //=> { ... }
  })
```

## Installation

```bash
npm install popsicle --save
bower install popsicle --save
```

## Usage

```js
var popsicle = require('popsicle')
// var popsicle = window.popsicle

popsicle({
  method: 'POST',
  url: 'http://example.com/api/users',
  body: {
    username: 'blakeembrey',
    password: 'hunter2'
  },
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})
  .then(function (res) {
    console.log(res.status) // => 200
    console.log(res.body) //=> { ... }
    console.log(res.get('Content-Type')) //=> 'application/json'
  })
```

### Handling Requests

* **url** The resource URI
* **method** The HTTP request method (default: `"GET"`)
* **headers** An object with HTTP headers, header name to value (default: `{}`)
* **query** An object or string to be appended to the URL as the query string
* **body** An object, string, form data, stream (node), etc to pass with the request
* **timeout** The number of milliseconds to wait before aborting the request (default: `Infinity`)
* **use** An array of plugins to be used (default: `[stringify, headers, parse]`)
* **options** Raw options used by the transport layer (default: `{}`)
* **transport** Override the transportation layer (default: `http.request/https.request` (node), `XMLHttpRequest` (brower))

**Options using node transport**

The default plugins under node are `[stringify, headers, cookieJar, unzip, concatStream('string'), parse]`, since the extra options aren't customizable for the browser.

* **jar** An instance of a cookie jar (`popsicle.jar()`) (default: `null`)
* **agent** Custom HTTP pooling agent (default: [infinity-agent](https://github.com/floatdrop/infinity-agent))
* **maxRedirects** Override the number of redirects allowed (default: `5`)
* **rejectUnauthorized** Reject invalid SSL certificates (default: `true`)
* **followRedirects** Disable redirects or use a function to accept `307`/`308` redirects (default: `true`)

**Options using browser transport**

* **withCredentials** Send cookies with CORS requests (default: `false`)
* **responseType** Set the XHR `responseType` (default: `undefined`)

#### Short-hand Methods

Every method has a short hand exposed under the main Popsicle function.

```js
popsicle.post('http://example.com/api/users')
```

#### Extending with Defaults

Create a new Popsicle function with defaults set. Handy for a consistent cookie jar or transport to be used.

```js
var cookiePopsicle = popsicle.defaults({ options: { jar: popsicle.jar() } })
```

#### Automatically Stringify Request Body

Popsicle can automatically serialize the request body with the built-in `stringify` plugin. If an object is supplied, it will automatically be stringified as JSON unless the `Content-Type` was set otherwise. If the `Content-Type` is `multipart/form-data` or `application/x-www-form-urlencoded`, it will be automatically serialized.

```js
popsicle({
  url: 'http://example.com/api/users',
  body: {
    username: 'blakeembrey'
  },
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})
```

#### Multipart Request Bodies

You can manually create form data by calling `popsicle.form`. When you pass a form data instance as the body, it'll automatically set the correct `Content-Type` - complete with boundary.

```js
var form = popsicle.form({
  username: 'blakeembrey',
  profileImage: fs.createReadStream('image.png')
})

popsicle.post({
  url: '/users',
  body: form
})
```

#### Aborting Requests

All requests can be aborted before or during execution by calling `Request#abort`.

```js
var request = popsicle('http://example.com')

setTimeout(function () {
  request.abort()
}, 100)

request.catch(function (err) {
  console.log(err) //=> { message: 'Request aborted', type: 'EABORTED' }
})
```

#### Progress

The request object can be used to check progress at any time.

* **request.uploadedBytes** Current upload size in bytes
* **request.uploadLength** Total upload size in bytes
* **request.uploaded** Total uploaded as a percentage
* **request.downloadedBytes** Current download size in bytes
* **request.downloadLength** Total download size in bytes
* **request.downloaded** Total downloaded as a percentage
* **request.completed** Total uploaded and downloaded as a percentage

All percentage properties (`request.uploaded`, `request.downloaded`, `request.completed`) are a number between `0` and `1`. Aborting the request will emit a progress event, if the request had started.

```js
var request = popsicle('http://example.com')

request.uploaded //=> 0
request.downloaded //=> 0

request.progress(function () {
  console.log(request) //=> { uploaded: 1, downloaded: 0, completed: 0.5, aborted: false }
})

request.then(function (response) {
  console.log(request.downloaded) //=> 1
})
```

#### Default Plugins

The default plugins are exposed under `popsicle.plugins`, which allows you to mix, match and omit some plugins for maximum usability with any use-case.

```js
{
  headers: [Function: headers],
  stringify: [Function: stringify],
  parse: [Function: parse],
  cookieJar: [Function: cookieJar],
  unzip: [Function: unzip],
  concatStream: [Function: concatStream],
  defaults: [
    [Function: stringify],
    [Function: headers],
    [Function: cookieJar],
    [Function: unzip],
    [Function: concatStream],
    [Function: parse]
  ]
}
```

* **headers** Sets default headers, such as `User-Agent`, `Accept`, `Content-Length` (Highly recommended)
* **stringify** Stringify object bodies into JSON/form data/url encoding (Recommended)
* **parse** Automatically parse JSON and url encoding responses
* **unzip** Automatically unzip response streams (Node only)
* **concatStream** Buffer the whole stream using [concat-stream](https://www.npmjs.com/package/concat-stream) - accepts an "encoding" type (`string` (default), `buffer`, `array`, `uint8array`, `object`) (Node only)
* **cookieJar** Support the cookie jar option in node (Recommended, Node only)

#### Cookie Jar (Node only)

You can create a reusable cookie jar instance for requests by calling `popsicle.jar`.

```js
var jar = request.jar()

popsicle({
  method: 'POST',
  url: '/users',
  options: {
    jar: jar
  }
})
```

### Handling Responses

Promises and node-style callbacks are both supported.

#### Promises

Promises are the most expressive interface. Just chain using `Request#then` or `Request#catch` and continue.

```js
popsicle('/users')
  .then(function (res) {
    // Success!
  })
  .catch(function (err) {
    // Something broke.
  })
```

If you live on the edge, try using it with generators (with [co](https://www.npmjs.com/package/co)) or ES7 `async`.

```js
co(function * () {
  yield popsicle('/users')
})
```

#### Callbacks

For tooling that still expects node-style callbacks, you can use `Request#exec`. This accepts a single function to call when the response is complete.

```js
popsicle('/users')
  .exec(function (err, res) {
    if (err) {
      // Something broke.
    }

    // Success!
  })
```

### Response Objects

Every Popsicle response will give a `Response` object on success. The object provides an intuitive interface for requesting common properties.

* **status** The HTTP response status code
* **body** An object (if parsed using a plugin) or string that was the response HTTP body
* **headers** An object of lower-cased keys to header values
* **url** The response URL after redirects (only supported in browser with `responseURL`)
* **statusType()** Return an integer with the HTTP status type (E.g. `200 -> 2`)
* **get(key)** Retrieve a HTTP header using a case-insensitive key
* **name(key)** Retrieve the original HTTP header name using a case-insensitive key
* **type()** Return the response type (E.g. `application/json`)

### Error Handling

All response handling methods can return an error. Errors have a `popsicle` property set to the request object and a `type` string. The built-in types are documented below, but custom errors can be created using `request.error(message, code, originalError)`.

* **EABORT** Request has been aborted by user
* **EUNAVAILABLE** Unable to connect to the remote URL
* **EINVALID** Request URL is invalid
* **ETIMEOUT** Request has exceeded the allowed timeout
* **ESTRINGIFY** Request body threw an error during stringification plugin
* **EPARSE** Response body threw an error during parsing plugin
* **EMAXREDIRECTS** Maximum number of redirects exceeded (Node only)
* **EBODY** Unable to handle request body (Node only)
* **EBLOCKED** The request was blocked (HTTPS -> HTTP) (Browsers only)
* **ECSP** Request violates the documents Content Security Policy (Browsers only)

### Plugins

Plugins can be passed in as an array with the initial options (which overrides default plugins), or they can be used via the chained method `Request#use`.

#### External Plugins

* [Server](https://github.com/blakeembrey/popsicle-server) - Automatically mount a server on each request (handy for testing)
* [Status](https://github.com/blakeembrey/popsicle-status) - Reject responses on HTTP failure status codes
* [No Cache](https://github.com/blakeembrey/popsicle-no-cache) - Prevent caching of HTTP requests in browsers
* [Basic Auth](https://github.com/blakeembrey/popsicle-basic-auth) - Add basic authentication headers to each request
* [Prefix](https://github.com/blakeembrey/popsicle-prefix) - Prefix all HTTP requests
* [Resolve](https://github.com/blakeembrey/popsicle-resolve) - Resolve all HTTP requests against a base URL
* [Constants](https://github.com/blakeembrey/popsicle-constants) - Replace constants in the URL string
* [Limit](https://github.com/blakeembrey/popsicle-limit) - Transparently handle API rate limits by grouping requests
* [Group](https://github.com/blakeembrey/popsicle-group) - Group requests and perform operations on them all at once

#### Creating Plugins

Plugins must be a function that accepts configuration and returns another function. For example, here's a basic URL prefix plugin.

```js
function prefix (url) {
  return function (request) {
    request.url = url + req.url
  }
}

popsicle('/user')
  .use(prefix('http://example.com'))
  .then(function (response) {
    console.log(response.url) //=> "http://example.com/user"
  })
```

Popsicle also has a way modify the request and response lifecycle, if needed. Any registered function can return a promise to defer the request or response resolution. This makes plugins such as rate-limiting and response body concatenation possible.

* **before(fn)** Register a function to run before the request is made
* **after(fn)** Register a function to receive the response object
* **always(fn)** Register a function that always runs on `resolve` or `reject`

#### Checking The Environment

```js
popsicle.browser //=> true
```

#### Transportation Layers

Creating a custom transportation layer is just a matter creating an object with `open`, `abort` and `use` options set. The open method should set any request information required between called as `request.raw`. Abort must abort the current request instance, while `open` must **always** resolve the promise. You can set `use` to an empty array if no plugins should be used by default. However, it's recommended you keep `use` set to the defaults, or as close as possible using your transport layer.

## TypeScript

This project is written using [TypeScript](https://github.com/Microsoft/TypeScript) and [typings](https://github.com/typings/typings). From version `1.3.1`, you can install the type definition using `typings`.

```
typings install npm:popsicle --name popsicle
```

## Development

Install dependencies and run the test runners (node and PhantomJS using Tap).

```
npm install && npm test
```

## Related Projects

* [Superagent](https://github.com/visionmedia/superagent) - HTTP requests for node and browsers
* [Fetch](https://github.com/github/fetch) - Browser polyfill for promise-based HTTP requests
* [Axios](https://github.com/mzabriskie/axios) - HTTP request API based on Angular's $http service

## License

MIT

[npm-image]: https://img.shields.io/npm/v/popsicle.svg?style=flat
[npm-url]: https://npmjs.org/package/popsicle
[downloads-image]: https://img.shields.io/npm/dm/popsicle.svg?style=flat
[downloads-url]: https://npmjs.org/package/popsicle
[travis-image]: https://img.shields.io/travis/blakeembrey/popsicle.svg?style=flat
[travis-url]: https://travis-ci.org/blakeembrey/popsicle
[coveralls-image]: https://img.shields.io/coveralls/blakeembrey/popsicle.svg?style=flat
[coveralls-url]: https://coveralls.io/r/blakeembrey/popsicle?branch=master
