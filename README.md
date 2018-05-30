# Injection

Hook all the things.

See [index.js](index.js) for documentation (for now)

## History

This originally started out as a couple Javascript "classes" (e.g. of the prototypical inheritance flavor) that were used to heavily modify an existing frontend, via tampermonkey.  They have since evolved a handful of times, being extended to more easily support interception at the prototype level, as well as more custom hook types.

They have been further refined over a few iterations, going from objects with prototype methods to es6 classes, and then into the current, very vanilla, more functional javascript approach.

These were used to inject custom code into particular runtime methods in this frontend.  For example, if I wanted to count the number of results being returned from an API call, I could intercept the network helper and peek at the return value before forwaring it on to the calling function, e.g.:

```javascript
/*
  Assume there exists some network library called `NetLib`, and `net` is
  an instance of NetLib.

  NetLib has a method on its prototype, named `getThings`:

  NetLib.prototype.getThings(cb) {
    this._get(THING_ENDPOINT, cb);
  }
 */

const counter = {
  count: 0,
  add: function(n) { this.count += n; }
};

const unhook = hook(function countThings(target, arguments) {
  const [cb] = arguments;
  // Call the original method, but wrap the callback in our own...
  return target.call(this, function(err, results) {
    counter.add(results.length);
    // Maybe we actually want to hide something...
    // hidden = results.splice(0, 1);
    cb(err, results);
  });
}, NetLib.prototype, 'getThings');

// ... somewhere in code we don't control:
net.getThings(handleThings);

/*
  Now, `net.getThings` calls our hook method instead, which replaces the
  `handleThings` callback with our own callback.  Our callback wraps 
  `handleThings` and lets us counts the results (any maybe even modify them)
  before calling `handleThings` itself.
 */

// ... Later, maybe we don't care about counting anymore:
unhook();

/*
  This uninstalls the hook, returning `getThings` to the original method.
 */
```
