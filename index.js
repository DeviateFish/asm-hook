/*
  This is a slightly different take on the javascript hooks. It uses the
  `handle` type hook as its basis, then builds all the other hook types
  from that simple building block.

  The result is actually quite straightforward.
 */

/**
 * Just a util function for those times I need to copy the arguments array
 * @param  {Arguments} arguments Function arguments
 * @return {Array}               Copy of the function arguments, as as array.
 */
function slice(arguments) {
  var l = arguments.length, i;
  var args = new Array(l);
  for (i = 0; i < l; i++) {
    args[i] = arguments[i];
  }
  return args;
}

/**
 * Replaces the method with name `methodName` with an intercept.  This
 * intercept forwards on the original target method, the arguments to
 * the method, and the current context.  It returns the return value of
 * the given intercept handler.
 * @param  {Function} fn         The intercept handler.  Function that accepts
 *                               two arguments: the original method, and the
 *                               current arguments.  `this` should be preserved
 * @param  {Object}   object     Object on which the method exists
 * @param  {String}   methodName Name of the target method
 * @return {Function}            Returns a function that can be used to unhook
 */
function hook(fn, object, methodName) {
  const target = object[methodName];
  object[methodName] = function() {
    return fn.apply(this, [target, arguments]);
  }
  return function unhook() {
    object[methodName] = target;
  }
};

/**
 * A specific hook pattern in which the handler is run, followed by the target,
 * with no interaction between the two.  The return value of the target
 * method is returned.
 * @param  {Function} fn         Function to run before the target
 * @param  {Object}   object     Object on which the method exists
 * @param  {String}   methodName Name of the target method
 * @return {Function}            Returns a function that can be used to unhook
 */
hook.preHook = function(fn, object, methodName) {
  return hook(
    function(target, arguments) {
      fn.apply(this, arguments);
      return target.apply(this, arguments);
    },
    object,
    methodName
  );
};

/**
 * A specific hook pattern in which the handler is run after the target,
 * with no interaction between the two.  The return value of the target
 * function is what is returned by the handler.
 * @param  {Function} fn         Function to run after the target
 * @param  {Object}   object     Object on which the method exists
 * @param  {String}   methodName Name of the target method
 * @return {Function}            Returns a function that can be used to unhook
 */
hook.postHook = function(fn, object, methodName) {
  return hook(
    function(target, arguments) {
      var returnValue = target.apply(this, arguments);
      fn.apply(this, arguments);
      return returnValue;
    },
    object,
    methodName
  );
};

/**
 * This hook pattern first calls the target, then appends its return
 * value to the original list of arguments, then calls the handler with
 * these arguments.  The target method's return value will always be the
 * last argument.
 * @param  {Function} fn         Function to postprocess the results of a
 *                               hooked function
 * @param  {Object}   object     Object on which the method exists
 * @param  {String}   methodName Name of the target method
 * @return {Function}            Returns a function that can be used to unhook
 */
hook.passThrough = function(fn, object, methodName) {
  return hook(
    function(target, arguments) {
      var args = slice(arguments);
      args.push(target.apply(this, arguments));
      return fn.apply(this, args);
    },
    object,
    methodName
  );
};

/**
 * This hook pattern is similar to `passThrough`, but the handler only
 * receives the return value of the target, instead of all of the arguments.
 * @param  {Function} fn         Function to handle the results of the target
 *                               function
 * @param  {Object}   object     Object on which the method exists
 * @param  {String}   methodName Name of the target method
 * @return {Function}            Returns a function that can be used to unhook
 */
hook.intercept = function(fn, object, methodName) {
  return hook(
    function(target, arguments) {
      return fn.call(this, target.apply(this, arguments));
    },
    object,
    methodName
  );
};

/**
 * The most bruteforce of hooks.  Only calls the handler function, never
 * the target function.  Use this to completely replace functionality.
 * @param  {Function} fn         New method to replace the target
 * @param  {Object}   object     Object on which the method exists
 * @param  {String}   methodName Name of the target method
 * @return {Function}            Returns a function that can be used to unhook
 */
hook.replace = function(fn, object, methodName) {
  return hook(
    function(_, arguments) {
      return fn.apply(this, arguments);
    },
    object,
    methodName
  );
};

/**
 * The conditional hook is slightly more complicated.  The handler is called
 * with the target's arguments, and should return a boolean result.  If this
 * return value is true, the target method is called.  If false, the
 * `defaultValue` is returned, instead.
 * @param  {Function} fn           Function to determine if the target should
 *                                 be called.  Should accept the target
 *                                 method's arguments and return a boolean.
 * @param  {Object}   object       Object on which the method exists
 * @param  {String}   methodName   Name of the target method
 * @param  {any}      defaultValue Value to return in the event that `fn`
 *                                 returns false
 * @return {Function}              Returns a function that can be used to unhook
 */
hook.conditionalHook = function(fn, object, methodName, defaultValue) {
  return hook(
    function(target, arguments) {
      if (fn.apply(this, arguments)) {
        return target.apply(this, arguments);
      }
      return defaultValue;
    },
    object,
    methodName
  );
};

module.exports = hook;
