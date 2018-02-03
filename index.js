/**
 * This file defines a set of utilities for interception functionality that
 * is implemented via prototypes and prototypical inheritance.
 *
 * This draws heavily on code injection techniques used to patch assembly
 * code to create custom behaviors.  For example, one of the injection methods
 * "wraps" the target method, calling a provided method first, then passing
 * the modified results to the target method.
 *
 * In Assembly, this would usually be done by patching the first few bytes
 * of a function call with an unconditional jump to a code cave.  The code cave
 * then runs the overwritten instructions, calls a custom method, then returns
 * control back to the original method with a second unconditional jump.
 */

function _nullHook() {
  throw new Error('Cannot call `hook` if the hook was never installed!');
}

/**
 * This class contains the basic functionality for both injections on object
 * instances, as well as via prototypical inheritance.
 */
export class ObjectInjection {

  /**
   * Creates a new injection, given an object a method to override, and
   * the function to override it with.
   *
   * This does not enable the injection, however.
   *
   * @param  {Object} obj    The target object
   * @param  {String} method The name of the target method
   * @param  {Function} func The method to override the target with
   *
   * @return {ObjectInjection}
   */
  constructor(obj, method, func) {
    if (typeof (obj[method]) === 'undefined') {
      throw "Object doesn't contain the method " + method;
    }
    // When hooking a method using one of the below hook styles,
    // `this.hook` will be set to a bound copy of the same method.
    // This allows for simply calling `hook()` to re-hook the
    // method after unhooking, without needing to know which
    // kind of hook was installed.
    this.hook = _nullHook;
    this.target = obj;
    this.methodName = method;
    this.oldMethod = obj[method];
    this.func = func;
    this.injected = false;
  }

  /**
   * Static class method for creating new injections.  Alternative to `new`
   * invocation
   *
   * @see  constructor
   * @param  {Object} obj    The target object
   * @param  {String} method The name of the target method
   * @param  {Function} func The method to override the target with
   *
   * @return {ObjectInjection}
   */
  static create(obj, method, func) {
    return new ObjectInjection(obj, method, func);
  }

  /**
   * Resets the hook.  Sets the method back to its original (bound) method
   *
   * @chainable
   * @return {this}
   */
  unhook() {
    this.target[this.methodName] = this.oldMethod;
    this.injected = false;
    return this;
  }

  /**
   * Enables the hook with the "pre-hook" method.  This calls the custom
   * method first, then calls the target method.  If the arguments to the
   * target method are references, it is possible to mutate the arguments.
   * However, the return value is unused, so beyond mutating the arguments
   * themselves, this passes the original args on to the original method
   * and returns its results.
   *
   * This hook style is useful for logging, for example.
   *
   * @chainable
   * @return {this}
   */
  preHook() {
    var that = this;
    return this._installHook(
      function hookWrapper() {
        that.func.apply(this, arguments);
        return that.oldMethod.apply(this, arguments);
      },
      this.preHook.bind(this)
    );
  }

  /**
   * Identical to `prehook`, except that the hook is called after the original
   * callback, but before its return value is returned.
   *
   * Also useful for logging.
   *
   * @chainable
   * @return {this}
   */
  postHook() {
    var that = this;
    return this._installHook(
      function hookWrapper() {
        var ret = that.oldMethod.apply(this, arguments);
        that.func.apply(this, arguments);
        return ret;
      },
      this.postHook.bind(this)
    );
  }

  /**
   * The `passthrough` hook captures the return value of the hooked function,
   * then calls the hook with the original arguments and the return value.
   *
   * The return value of the hook is what is returned to the original caller.
   *
   * Useful for injecting conditional flow or intercepting and modifying
   * results of protected functions, under conditions that require knowledge
   * of the original arguments.
   *
   * @chainable
   * @return {this}
   */
  passThrough() {
    var that = this;
    return this._installHook(
      function hookWrapper() {
        var l = arguments.length;
        var args = new Array(l);
        for (var i = 0; i < l; i++) {
          args[i] = arguments[i];
        }
        var ret = that.oldMethod.apply(this, arguments);
        args.push(ret);
        return that.func.apply(this, args);
      },
      this.passThrough.bind(this)
    );
  }

  /**
   * The `intercept` hook is similar to `passThrough`, but does not accept
   * the original arguments to the hooked function.  Instead, the hook function
   * only receives the return value of the original function, and then passes
   * the return value of the hook on.
   *
   * Useful for injecting conditional flow or modifying the results of a
   * protected method, without needing to know what the original arguments
   * were.
   *
   * @chainable
   * @return {this}
   */
  intercept() {
    var that = this;
    return this._installHook(
      function hookWrapper() {
        var ret = that.oldMethod.apply(this, arguments);
        return that.func.apply(this, [ret]);
      },
      this.intercept.bind(this)
    );
  }

  /**
   * The `replace` hook simply replaces the target method with the hook method.
   *
   * Useful for completely replacing functionality of a target method.
   *
   * @chainable
   * @return {this}
   */
  replace() {
    return this._installHook(
      this.func.bind(this.target),
      this.replace.bind(this)
    );
  }

  /**
   * The `conditionalHook` method differs slightly from the others in that
   * it expects the hook function to return a boolean that determines whether
   * or not the original method should be called.  If the original should *not*
   * be called, `_default` is returned instead.
   *
   * @param  {any} _default   The default value to be returned if the original
   *                          method is not to be called.
   *
   * @chainable
   * @return {this}
   */
  conditionalHook(_default) {
    var that = this;
    return this._installHook(
      function hookWrapper() {
        if (that.func.apply(this, arguments)) {
          return that.oldMethod.apply(this, arguments);
        }
        return _default;
      },
      this.conditionalHook.bind(this, _default)
    );
  }

  /**
   * The `handle` hook provides the greatest granularity and control over
   * the hooked method.  The hook method should accept two arguments: the
   * original method, and an array containing the arguments it was called with.
   *
   * This allows for complete control over the invocation of the original
   * method, with complete knowledge of the arguments it was invoked with.
   *
   * Useful for benchmarking or timing--i.e. sample the time before and
   * after a method is called to determine how long it took to execute.
   *
   * @chainable
   * @return {this}
   */
  handle() {
    var that = this;
    return this._installHook(
      function hookWrapper() {
        var handler = that.oldMethod;
        var l = arguments.length;
        var args = new Array(l);
        for (var i = 0; i < l; i++) {
          args[i] = arguments[i];
        }
        return that.func.apply(this, [handler, args]);
      },
      this.handle.bind(this)
    );
  }

  _installHook(hookWrapper, hookMethod) {
    if (this.injected) {
      this.unhook();
    }
    this.target[this.methodName] = hookWrapper;
    this.hook = hookMethod;
    this.injected = true;
    return this;
  }
}

/**
 * The PrototypeInjection class provides the same methods as the
 * `ObjectInjection` class, but implicitly overrides methods on the object's
 * prototype, rather than the object itself.
 *
 * This is extremely useful when all instances (already instantiated or
 * yet-to-be instantiated) should be intercepted.
 */
export class PrototypeInjection extends ObjectInjection {

  /**
   * Creates a new injection, given an object whose prototype is to be
   * overriden, a method on that prototype to override, and the function to
   * override it with.
   *
   * This does not enable the injection, however.
   *
   * @param  {Object} obj    The object whose prototype is to be hooked
   * @param  {String} method The name of the target method
   * @param  {Function} func The method to override the target with
   *
   * @return {ObjectInjection}
   */
  constructor(obj, method, func) {
    super(obj.prototype, method, func);
  }

  /**
   * Static class method for creating new injections.  Alternative to `new`
   * invocation
   *
   * @see  constructor
   * @param  {Object} obj    The target object
   * @param  {String} method The name of the target method
   * @param  {Function} func The method to override the target with
   *
   * @return {ObjectInjection}
   */
  static create(obj, method, func) {
    return new PrototypeInjection(obj, method, func);
  }
}
